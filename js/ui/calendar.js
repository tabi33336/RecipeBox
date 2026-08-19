import { getAllRecipes, getAllMealPlanEntries, putMealPlanEntry, deleteMealPlanEntry, genId } from '../data/db.js';
import { pushChanges, pushDeletion } from '../data/sync.js';
import {
  MEAL_TYPES, MEAL_TYPE_LABELS, toDateKey, parseDateKey, formatMonthLabel, getMonthGrid,
  getWeekGrid, formatWeekdayLabel, formatWeekRangeLabel, groupEntriesByDate,
} from '../data/mealPlanUtils.js';
import { reportSyncError } from '../utils/syncFeedback.js';
import { UI_ICONS } from '../icons.js';

const els = {};
let viewMode = 'week';
let currentDate = new Date();
let recipesCache = [];
let entriesCache = [];
let entriesByDate = new Map();
let openDayKey = null;
let pickerDateKey = null;
let pickerMealType = null;
let lastScrollY = 0;
const SCROLL_HIDE_THRESHOLD = 6;
const SCROLL_TOP_MARGIN = 40;

function q(id) { return document.getElementById(id); }

export function initCalendar() {
  els.view = q('view-calendar');
  els.header = q('calendarHeader');
  els.label = q('calLabel');
  els.btnPrev = q('btnCalPrev');
  els.btnNext = q('btnCalNext');
  els.btnToday = q('btnCalToday');
  els.modeToggle = q('calModeToggle');
  els.weekView = q('calendarWeekView');
  els.weekList = q('calendarWeekList');
  els.monthView = q('calendarMonthView');
  els.grid = q('calendarGrid');

  els.dayDetailOverlay = q('dayDetailOverlay');
  els.dayDetailTitle = q('dayDetailTitle');
  els.dayDetailMealTypes = q('dayDetailMealTypes');
  els.btnCloseDayDetail = q('btnCloseDayDetail');

  els.recipePickerOverlay = q('recipePickerOverlay');
  els.recipePickerSearch = q('recipePickerSearch');
  els.recipePickerList = q('recipePickerList');
  els.btnCloseRecipePicker = q('btnCloseRecipePicker');

  els.btnPrev.innerHTML = UI_ICONS.back;
  els.btnNext.innerHTML = `<span style="display:inline-flex; transform: scaleX(-1);">${UI_ICONS.back}</span>`;
  els.btnCloseDayDetail.innerHTML = UI_ICONS.close;
  els.btnCloseRecipePicker.innerHTML = UI_ICONS.close;

  els.btnPrev.addEventListener('click', () => changeDate(-1));
  els.btnNext.addEventListener('click', () => changeDate(1));
  els.btnToday.addEventListener('click', () => {
    currentDate = new Date();
    renderCurrentView();
  });

  for (const btn of els.modeToggle.querySelectorAll('.calendar-mode-toggle__btn')) {
    btn.addEventListener('click', () => setViewMode(btn.dataset.mode));
  }

  els.dayDetailOverlay.addEventListener('click', (e) => { if (e.target === els.dayDetailOverlay) closeDayDetail(); });
  els.btnCloseDayDetail.addEventListener('click', closeDayDetail);

  els.recipePickerOverlay.addEventListener('click', (e) => { if (e.target === els.recipePickerOverlay) closeRecipePicker(); });
  els.btnCloseRecipePicker.addEventListener('click', closeRecipePicker);
  els.recipePickerSearch.addEventListener('input', () => renderRecipePickerList());

  updateAppHeaderHeightVar();
  window.addEventListener('resize', updateAppHeaderHeightVar);
  window.addEventListener('scroll', onWindowScroll, { passive: true });
}

function updateAppHeaderHeightVar() {
  const appHeader = document.querySelector('.app-header');
  if (!appHeader) return;
  document.documentElement.style.setProperty('--app-header-h', `${appHeader.offsetHeight}px`);
}

function showCalendarHeader() {
  els.header.classList.remove('collapsed');
}

function onWindowScroll() {
  if (els.view.hidden) return;
  const currentY = window.scrollY;
  if (currentY <= SCROLL_TOP_MARGIN) {
    showCalendarHeader();
  } else if (currentY - lastScrollY > SCROLL_HIDE_THRESHOLD) {
    els.header.classList.add('collapsed');
  } else if (lastScrollY - currentY > SCROLL_HIDE_THRESHOLD) {
    showCalendarHeader();
  }
  lastScrollY = currentY;
}

function setViewMode(mode) {
  viewMode = mode;
  for (const btn of els.modeToggle.querySelectorAll('.calendar-mode-toggle__btn')) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  }
  els.weekView.hidden = mode !== 'week';
  els.monthView.hidden = mode !== 'month';
  showCalendarHeader();
  renderCurrentView();
}

function changeDate(delta) {
  if (viewMode === 'week') {
    currentDate.setDate(currentDate.getDate() + delta * 7);
  } else {
    currentDate.setDate(1);
    currentDate.setMonth(currentDate.getMonth() + delta);
  }
  renderCurrentView();
}

export async function renderCalendar() {
  recipesCache = await getAllRecipes();
  entriesCache = await getAllMealPlanEntries();
  entriesByDate = groupEntriesByDate(entriesCache);
  lastScrollY = window.scrollY;
  setViewMode('week');
}

function renderCurrentView() {
  if (viewMode === 'week') {
    renderWeekList();
  } else {
    renderMonthGrid();
  }
}

function renderMealTypeSections(container, dateKey) {
  container.innerHTML = '';
  const entries = entriesByDate.get(dateKey) || [];
  for (const mealType of MEAL_TYPES) {
    const section = document.createElement('div');
    section.className = 'meal-type-section';

    const header = document.createElement('div');
    header.className = 'edit-section__header';
    const label = document.createElement('span');
    label.className = 'card-title';
    label.textContent = MEAL_TYPE_LABELS[mealType];
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn-secondary';
    addBtn.innerHTML = `${UI_ICONS.plus} 追加`;
    addBtn.addEventListener('click', () => openRecipePicker(dateKey, mealType));
    header.append(label, addBtn);
    section.appendChild(header);

    const mealEntries = entries.filter((e) => e.mealType === mealType);
    if (mealEntries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'meal-entry-empty';
      empty.textContent = '未設定';
      section.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'meal-entry-list';
      for (const entry of mealEntries) {
        const recipe = recipesCache.find((r) => r.id === entry.recipeId);
        const chip = document.createElement('div');
        chip.className = 'meal-entry-chip';
        const title = document.createElement('span');
        title.textContent = recipe ? recipe.title : '（削除済み）';
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-icon';
        removeBtn.innerHTML = UI_ICONS.close;
        removeBtn.addEventListener('click', () => removeEntry(entry.id));
        chip.append(title, removeBtn);
        list.appendChild(chip);
      }
      section.appendChild(list);
    }

    container.appendChild(section);
  }
}

function renderWeekList() {
  const days = getWeekGrid(currentDate);
  els.label.textContent = formatWeekRangeLabel(days);
  els.weekList.innerHTML = '';
  const todayKey = toDateKey(new Date());

  for (const date of days) {
    const key = toDateKey(date);
    const dayCard = document.createElement('div');
    dayCard.className = 'calendar-week-day';
    if (key === todayKey) dayCard.classList.add('today');

    const header = document.createElement('div');
    header.className = 'calendar-week-day__header';
    const dateLabel = document.createElement('span');
    dateLabel.className = 'calendar-week-day__date';
    dateLabel.textContent = `${date.getMonth() + 1}月${date.getDate()}日（${formatWeekdayLabel(date)}）`;
    header.appendChild(dateLabel);
    dayCard.appendChild(header);

    const mealTypes = document.createElement('div');
    renderMealTypeSections(mealTypes, key);
    dayCard.appendChild(mealTypes);

    els.weekList.appendChild(dayCard);
  }
}

function renderMonthGrid() {
  els.label.textContent = formatMonthLabel(currentDate.getFullYear(), currentDate.getMonth());
  els.grid.innerHTML = '';
  const days = getMonthGrid(currentDate.getFullYear(), currentDate.getMonth());
  const todayKey = toDateKey(new Date());

  for (const date of days) {
    const key = toDateKey(date);
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'calendar-day';
    if (date.getMonth() !== currentDate.getMonth()) cell.classList.add('outside-month');
    if (key === todayKey) cell.classList.add('today');

    const dateLabel = document.createElement('span');
    dateLabel.className = 'calendar-day__date';
    dateLabel.textContent = String(date.getDate());
    cell.appendChild(dateLabel);

    const entries = entriesByDate.get(key) || [];
    if (entries.length > 0) {
      const list = document.createElement('div');
      list.className = 'calendar-day__entries';
      const visible = entries.slice(0, 3);
      for (const entry of visible) {
        const recipe = recipesCache.find((r) => r.id === entry.recipeId);
        const line = document.createElement('span');
        line.className = 'calendar-day__entry';
        line.textContent = recipe ? recipe.title : '（削除済み）';
        list.appendChild(line);
      }
      if (entries.length > visible.length) {
        const more = document.createElement('span');
        more.className = 'calendar-day__more';
        more.textContent = `+${entries.length - visible.length}`;
        list.appendChild(more);
      }
      cell.appendChild(list);
    }

    cell.addEventListener('click', () => openDayDetail(key));
    els.grid.appendChild(cell);
  }
}

function closeDayDetail() {
  els.dayDetailOverlay.classList.remove('open');
  openDayKey = null;
}

function openDayDetail(dateKey) {
  openDayKey = dateKey;
  const date = parseDateKey(dateKey);
  els.dayDetailTitle.textContent = `${date.getMonth() + 1}月${date.getDate()}日`;
  renderMealTypeSections(els.dayDetailMealTypes, openDayKey);
  els.dayDetailOverlay.classList.add('open');
}

async function removeEntry(entryId) {
  await deleteMealPlanEntry(entryId);
  entriesCache = entriesCache.filter((e) => e.id !== entryId);
  entriesByDate = groupEntriesByDate(entriesCache);
  if (openDayKey) renderMealTypeSections(els.dayDetailMealTypes, openDayKey);
  renderCurrentView();
  pushDeletion('mealPlanEntry', entryId).catch(reportSyncError);
}

function openRecipePicker(dateKey, mealType) {
  pickerDateKey = dateKey;
  pickerMealType = mealType;
  els.recipePickerSearch.value = '';
  renderRecipePickerList();
  els.recipePickerOverlay.classList.add('open');
}

function closeRecipePicker() {
  els.recipePickerOverlay.classList.remove('open');
  pickerDateKey = null;
  pickerMealType = null;
}

function renderRecipePickerList() {
  const query = els.recipePickerSearch.value.trim().toLowerCase();
  const filtered = query
    ? recipesCache.filter((r) => (r.title || '').toLowerCase().includes(query))
    : recipesCache;

  els.recipePickerList.innerHTML = '';
  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'card-meta';
    empty.textContent = '該当するレシピが見つかりません。';
    els.recipePickerList.appendChild(empty);
    return;
  }
  for (const recipe of filtered) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'recipe-picker-item';
    item.textContent = recipe.title;
    item.addEventListener('click', () => selectRecipe(recipe.id));
    els.recipePickerList.appendChild(item);
  }
}

async function selectRecipe(recipeId) {
  const entry = {
    id: genId(),
    date: pickerDateKey,
    mealType: pickerMealType,
    recipeId,
    memo: '',
    createdAt: Date.now(),
  };
  const saved = await putMealPlanEntry(entry);
  entriesCache = [...entriesCache, saved];
  entriesByDate = groupEntriesByDate(entriesCache);
  closeRecipePicker();
  if (openDayKey) renderMealTypeSections(els.dayDetailMealTypes, openDayKey);
  renderCurrentView();
  pushChanges().catch(reportSyncError);
}
