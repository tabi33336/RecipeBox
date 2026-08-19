import { getAllRecipes, getAllFolders, putRecipe, deleteRecipe, genId, getAllMealPlanEntries, deleteMealPlanEntriesForRecipe } from './data/db.js';
import { filterBlankIngredients, filterBlankSteps } from './data/recipeUtils.js';
import { pushChanges, pushDeletion, fullSync, isSyncEnabled } from './data/sync.js';
import { initList, renderList } from './ui/list.js';
import { initDetail, renderDetail } from './ui/detail.js';
import { initEdit, loadRecipeIntoForm, collectFormData } from './ui/edit.js';
import { initSettings, renderSettings } from './ui/settings.js';
import { initFolders, openFolderManage } from './ui/folders.js';
import { initCalendar, renderCalendar } from './ui/calendar.js';
import { initShoppingList, renderShoppingList } from './ui/shoppingList.js';
import { shareRecipe } from './features/share.js';
import { confirmDialog } from './utils/confirmDialog.js';
import { showToast } from './utils/toast.js';
import { reportSyncError } from './utils/syncFeedback.js';
import { UI_ICONS } from './icons.js';

const state = {
  view: 'list',
  recipes: [],
  folders: [],
  filterFolderId: 'all',
  search: '',
  sortMode: 'newest',
  currentRecipeId: null,
  editReturnView: 'list',
};

function q(id) { return document.getElementById(id); }

const header = {
  title: q('headerTitle'),
  btnBack: q('btnBack'),
  actionsList: q('actionsList'),
  actionsDetail: q('actionsDetail'),
  actionsEdit: q('actionsEdit'),
  actionsCalendar: q('actionsCalendar'),
  actionsShopping: q('actionsShopping'),
  actionsSettings: q('actionsSettings'),
  btnSettings: q('btnSettings'),
  btnAddRecipe: q('btnAddRecipe'),
  btnShareRecipe: q('btnShareRecipe'),
  btnEditRecipe: q('btnEditRecipe'),
  btnDeleteRecipe: q('btnDeleteRecipe'),
  btnSaveRecipe: q('btnSaveRecipe'),
};

const views = {
  list: q('view-list'),
  calendar: q('view-calendar'),
  shopping: q('view-shopping'),
  detail: q('view-detail'),
  edit: q('view-edit'),
  settings: q('view-settings'),
};

const tabBar = {
  el: q('tabBar'),
  items: Array.from(document.querySelectorAll('.tab-bar__item')),
};

function currentRecipe() {
  return state.recipes.find((r) => r.id === state.currentRecipeId) || null;
}

function currentFolder(recipe) {
  return state.folders.find((f) => f.id === recipe.folderId) || null;
}

async function loadData() {
  [state.recipes, state.folders] = await Promise.all([getAllRecipes(), getAllFolders()]);
}

function navigate(view, opts = {}) {
  state.view = view;
  for (const key of Object.keys(views)) views[key].hidden = key !== view;
  header.btnBack.hidden = view !== 'detail' && view !== 'edit';
  header.actionsList.hidden = view !== 'list';
  header.actionsDetail.hidden = view !== 'detail';
  header.actionsEdit.hidden = view !== 'edit';
  header.actionsCalendar.hidden = view !== 'calendar';
  header.actionsShopping.hidden = view !== 'shopping';
  header.actionsSettings.hidden = view !== 'settings';

  tabBar.el.hidden = view === 'detail' || view === 'edit';
  for (const item of tabBar.items) {
    item.classList.toggle('active', item.dataset.tab === view);
  }

  if (view === 'list') {
    header.title.textContent = 'レシピ帳';
    renderList(state);
  } else if (view === 'calendar') {
    header.title.textContent = '献立カレンダー';
    renderCalendar();
  } else if (view === 'shopping') {
    header.title.textContent = '買い物リスト';
    renderShoppingList();
  } else if (view === 'detail') {
    const recipe = currentRecipe();
    header.title.textContent = recipe.title;
    renderDetail(recipe, currentFolder(recipe));
  } else if (view === 'edit') {
    header.title.textContent = opts.recipe ? 'レシピを編集' : '新しいレシピ';
    loadRecipeIntoForm(opts.recipe || null, state.folders);
  } else if (view === 'settings') {
    header.title.textContent = '設定';
    renderSettings();
  }
}

function refreshListView() {
  if (state.view === 'list') renderList(state);
}

async function handleSave() {
  const data = collectFormData();
  if (!data.title) {
    alert('料理名を入力してください。');
    return;
  }
  data.ingredients = filterBlankIngredients(data.ingredients);
  data.steps = filterBlankSteps(data.steps);

  const existing = currentRecipe();
  const recipe = {
    id: existing && state.editReturnView === 'detail' ? existing.id : genId(),
    createdAt: existing && state.editReturnView === 'detail' ? existing.createdAt : Date.now(),
    ...data,
  };
  await putRecipe(recipe);
  await loadData();
  state.currentRecipeId = recipe.id;
  navigate('detail');
  pushChanges().catch(reportSyncError);
}

async function handleDelete() {
  const recipe = currentRecipe();
  const mealPlanEntries = await getAllMealPlanEntries();
  const relatedCount = mealPlanEntries.filter((e) => e.recipeId === recipe.id).length;
  const message = relatedCount > 0
    ? `「${recipe.title}」を削除しますか？この操作は取り消せません。献立カレンダーに登録されている${relatedCount}件の予定も削除されます。`
    : `「${recipe.title}」を削除しますか？この操作は取り消せません。`;
  const ok = await confirmDialog(message, '削除する');
  if (!ok) return;
  await deleteRecipe(recipe.id);
  const deletedEntries = await deleteMealPlanEntriesForRecipe(recipe.id);
  await loadData();
  navigate('list');
  pushDeletion('recipe', recipe.id).catch(reportSyncError);
  for (const entry of deletedEntries) {
    pushDeletion('mealPlanEntry', entry.id).catch(reportSyncError);
  }
}

async function handleShare() {
  const recipe = currentRecipe();
  const result = await shareRecipe(recipe);
  if (result === 'copied') showToast('共有テキストをコピーしました');
  if (result === 'failed') showToast('共有に失敗しました');
}

function bindHeaderIcons() {
  header.btnBack.innerHTML = UI_ICONS.back;
  header.btnSettings.innerHTML = UI_ICONS.settings;
  header.btnAddRecipe.innerHTML = UI_ICONS.plus;
  header.btnShareRecipe.innerHTML = UI_ICONS.share;
  header.btnEditRecipe.innerHTML = UI_ICONS.edit;
  header.btnDeleteRecipe.innerHTML = UI_ICONS.trash;
}

function bindTabBar() {
  q('tabIconList').innerHTML = UI_ICONS.list;
  q('tabIconCalendar').innerHTML = UI_ICONS.calendar;
  q('tabIconShopping').innerHTML = UI_ICONS.cart;
  q('tabIconSettings').innerHTML = UI_ICONS.settings;
  for (const item of tabBar.items) {
    item.addEventListener('click', () => navigate(item.dataset.tab));
  }
}

function bindHeaderActions() {
  header.btnBack.addEventListener('click', () => {
    if (state.view === 'edit') {
      navigate(state.editReturnView, state.editReturnView === 'detail' ? { recipe: currentRecipe() } : {});
    } else {
      navigate('list');
    }
  });
  header.btnSettings.addEventListener('click', () => navigate('settings'));
  header.btnAddRecipe.addEventListener('click', () => {
    state.currentRecipeId = null;
    state.editReturnView = 'list';
    navigate('edit');
  });
  header.btnEditRecipe.addEventListener('click', () => {
    state.editReturnView = 'detail';
    navigate('edit', { recipe: currentRecipe() });
  });
  header.btnDeleteRecipe.addEventListener('click', handleDelete);
  header.btnShareRecipe.addEventListener('click', handleShare);
  header.btnSaveRecipe.addEventListener('click', handleSave);
}

async function init() {
  bindHeaderIcons();
  bindHeaderActions();
  bindTabBar();
  initCalendar();
  initShoppingList();

  initList({
    onOpenRecipe: (id) => {
      state.currentRecipeId = id;
      navigate('detail');
    },
    onFilterFolder: (id) => {
      state.filterFolderId = id;
      refreshListView();
    },
    onSearchInput: (value) => {
      state.search = value;
      refreshListView();
    },
    onSortSelect: (mode) => {
      state.sortMode = mode;
      refreshListView();
    },
    onManageFolders: () => openFolderManage(state.folders),
  });
  initDetail();
  initEdit();
  initSettings(async () => {
    await loadData();
    refreshListView();
  });
  initFolders(async () => {
    await loadData();
    refreshListView();
    pushChanges().catch(reportSyncError);
  });

  window.addEventListener('online', () => {
    if (isSyncEnabled()) {
      fullSync()
        .then(() => { loadData().then(refreshListView); })
        .catch(reportSyncError);
    }
  });

  if (isSyncEnabled()) {
    try {
      await fullSync();
    } catch (err) {
      console.warn('sync: initial sync failed', err);
    }
  }

  await loadData();
  navigate('list');
}

init();
