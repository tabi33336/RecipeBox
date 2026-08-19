import { getAllMealPlanEntries, getAllRecipes, getAllUserIngredientAliases, getAllShoppingLists, putShoppingList, deleteShoppingList, genId } from '../data/db.js';
import { pushChanges, pushDeletion } from '../data/sync.js';
import { buildAliasMap } from '../data/ingredientNormalize.js';
import { aggregateIngredients, formatShoppingItem } from '../features/shoppingListAggregate.js';
import { toDateKey } from '../data/mealPlanUtils.js';
import { confirmDialog } from '../utils/confirmDialog.js';
import { reportSyncError } from '../utils/syncFeedback.js';
import { UI_ICONS } from '../icons.js';

const els = {};
let listsCache = [];
let currentList = null;

function q(id) { return document.getElementById(id); }

export function initShoppingList() {
  els.startDate = q('shoppingStartDate');
  els.endDate = q('shoppingEndDate');
  els.btnCreate = q('btnCreateShoppingList');
  els.presetButtons = Array.from(document.querySelectorAll('#view-shopping .chip[data-preset]'));
  els.listSection = q('shoppingListSection');
  els.rangeLabel = q('shoppingListRangeLabel');
  els.btnDeleteList = q('btnDeleteShoppingList');
  els.itemsContainer = q('shoppingListItems');
  els.manualName = q('shoppingManualName');
  els.manualAmount = q('shoppingManualAmount');
  els.manualUnit = q('shoppingManualUnit');
  els.btnAddManual = q('btnAddManualItem');
  els.historyList = q('shoppingHistoryList');

  els.btnDeleteList.innerHTML = UI_ICONS.trash;

  els.btnCreate.addEventListener('click', handleCreate);
  els.btnDeleteList.addEventListener('click', handleDeleteCurrentList);
  els.btnAddManual.addEventListener('click', handleAddManualItem);

  for (const btn of els.presetButtons) {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  }
}

function applyPreset(preset) {
  const offsetWeeks = preset === 'nextWeek' ? 1 : 0;
  const [start, end] = getWeekRange(offsetWeeks);
  els.startDate.value = toDateKey(start);
  els.endDate.value = toDateKey(end);
}

function getWeekRange(offsetWeeks) {
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay() + offsetWeeks * 7);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  return [sunday, saturday];
}

export async function renderShoppingList() {
  listsCache = await getAllShoppingLists();
  if (!els.startDate.value || !els.endDate.value) {
    applyPreset('thisWeek');
  }
  if (!currentList && listsCache.length > 0) {
    currentList = [...listsCache].sort((a, b) => b.createdAt - a.createdAt)[0];
  }
  renderCurrentList();
  renderHistory();
}

async function handleCreate() {
  const startDate = els.startDate.value;
  const endDate = els.endDate.value;
  if (!startDate || !endDate) {
    alert('期間を指定してください。');
    return;
  }
  if (startDate > endDate) {
    alert('開始日は終了日より前にしてください。');
    return;
  }
  const [entries, recipes, userAliases] = await Promise.all([
    getAllMealPlanEntries(), getAllRecipes(), getAllUserIngredientAliases(),
  ]);
  const inRange = entries.filter((e) => e.date >= startDate && e.date <= endDate);
  const aliasMap = buildAliasMap(userAliases);
  const items = aggregateIngredients(inRange, recipes, aliasMap);
  const list = { id: genId(), startDate, endDate, items, createdAt: Date.now() };
  const saved = await putShoppingList(list);
  listsCache = [...listsCache, saved];
  currentList = saved;
  renderCurrentList();
  renderHistory();
  pushChanges().catch(reportSyncError);
}

function renderCurrentList() {
  if (!currentList) {
    els.listSection.hidden = true;
    return;
  }
  els.listSection.hidden = false;
  els.rangeLabel.textContent = `${currentList.startDate} 〜 ${currentList.endDate}`;
  els.itemsContainer.innerHTML = '';
  if (currentList.items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'card-meta';
    empty.textContent = 'この期間に登録された献立はありません。';
    els.itemsContainer.appendChild(empty);
    return;
  }
  currentList.items.forEach((item, index) => {
    els.itemsContainer.appendChild(renderItemRow(item, index));
  });
}

function renderItemRow(item, index) {
  const row = document.createElement('label');
  row.className = 'shopping-item' + (item.checked ? ' checked' : '');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = !!item.checked;
  checkbox.addEventListener('change', () => toggleItem(index, checkbox.checked));

  const text = document.createElement('span');
  text.className = 'shopping-item__text';
  text.textContent = formatShoppingItem(item);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn btn-icon';
  removeBtn.innerHTML = UI_ICONS.close;
  removeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeItem(index);
  });

  row.append(checkbox, text, removeBtn);
  return row;
}

async function persistCurrentList() {
  const saved = await putShoppingList(currentList);
  currentList = saved;
  listsCache = listsCache.map((l) => (l.id === saved.id ? saved : l));
  pushChanges().catch(reportSyncError);
}

async function toggleItem(index, checked) {
  currentList.items[index].checked = checked;
  await persistCurrentList();
  renderCurrentList();
  renderHistory();
}

async function removeItem(index) {
  currentList.items.splice(index, 1);
  await persistCurrentList();
  renderCurrentList();
  renderHistory();
}

async function handleAddManualItem() {
  const name = els.manualName.value.trim();
  if (!name) return;
  const amountRaw = els.manualAmount.value.trim();
  const amount = amountRaw && /^-?\d+(\.\d+)?$/.test(amountRaw) ? parseFloat(amountRaw) : amountRaw;
  const unit = els.manualUnit.value.trim();

  if (!currentList) {
    const today = toDateKey(new Date());
    currentList = { id: genId(), startDate: today, endDate: today, items: [], createdAt: Date.now() };
    listsCache = [...listsCache, currentList];
  }
  currentList.items.push({ name, amount, unit, checked: false, manuallyAdded: true });
  await persistCurrentList();
  els.manualName.value = '';
  els.manualAmount.value = '';
  els.manualUnit.value = '';
  renderCurrentList();
  renderHistory();
}

async function handleDeleteCurrentList() {
  if (!currentList) return;
  const ok = await confirmDialog('この買い物リストを削除しますか？', '削除する');
  if (!ok) return;
  const deletedId = currentList.id;
  await deleteShoppingList(deletedId);
  listsCache = listsCache.filter((l) => l.id !== deletedId);
  currentList = listsCache.length > 0 ? [...listsCache].sort((a, b) => b.createdAt - a.createdAt)[0] : null;
  renderCurrentList();
  renderHistory();
  pushDeletion('shoppingList', deletedId).catch(reportSyncError);
}

function renderHistory() {
  els.historyList.innerHTML = '';
  const sorted = [...listsCache].sort((a, b) => b.createdAt - a.createdAt);
  if (sorted.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'card-meta';
    empty.textContent = 'まだ買い物リストがありません。';
    els.historyList.appendChild(empty);
    return;
  }
  for (const list of sorted) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'recipe-picker-item';
    const checkedCount = list.items.filter((i) => i.checked).length;
    const activeMark = currentList && currentList.id === list.id ? '● ' : '';
    btn.textContent = `${activeMark}${list.startDate} 〜 ${list.endDate}（${checkedCount}/${list.items.length}）`;
    btn.addEventListener('click', () => {
      currentList = list;
      renderCurrentList();
      renderHistory();
    });
    els.historyList.appendChild(btn);
  }
}
