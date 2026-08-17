import { getAllRecipes, getAllFolders, putRecipe, deleteRecipe, genId } from './data/db.js';
import { filterBlankIngredients, filterBlankSteps } from './data/recipeUtils.js';
import { initList, renderList } from './ui/list.js';
import { initDetail, renderDetail } from './ui/detail.js';
import { initEdit, loadRecipeIntoForm, collectFormData } from './ui/edit.js';
import { initSettings, renderSettings } from './ui/settings.js';
import { initFolders, openFolderManage } from './ui/folders.js';
import { shareRecipe } from './features/share.js';
import { confirmDialog } from './utils/confirmDialog.js';
import { showToast } from './utils/toast.js';
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
  detail: q('view-detail'),
  edit: q('view-edit'),
  settings: q('view-settings'),
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
  header.btnBack.hidden = view === 'list';
  header.actionsList.hidden = view !== 'list';
  header.actionsDetail.hidden = view !== 'detail';
  header.actionsEdit.hidden = view !== 'edit';
  header.actionsSettings.hidden = view !== 'settings';

  if (view === 'list') {
    header.title.textContent = 'レシピ帳';
    renderList(state);
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
}

async function handleDelete() {
  const recipe = currentRecipe();
  const ok = await confirmDialog(`「${recipe.title}」を削除しますか？この操作は取り消せません。`, '削除する');
  if (!ok) return;
  await deleteRecipe(recipe.id);
  await loadData();
  navigate('list');
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
  initSettings();
  initFolders(async () => {
    await loadData();
    refreshListView();
  });

  await loadData();
  navigate('list');
}

init();
