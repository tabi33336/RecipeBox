import { UI_ICONS, iconMarkup } from '../icons.js';
import { formatIngredient, sortRecipes, SORT_LABELS } from '../data/recipeUtils.js';

const els = {};
let cb = {};

function q(id) { return document.getElementById(id); }

export function initList(callbacks) {
  cb = callbacks;
  els.searchInput = q('searchInput');
  els.searchIcon = q('searchIcon');
  els.btnSort = q('btnSort');
  els.sortMenu = q('sortMenu');
  els.folderChips = q('folderChips');
  els.recipeList = q('recipeList');
  els.emptyState = q('listEmptyState');

  els.searchIcon.innerHTML = UI_ICONS.search;
  els.btnSort.innerHTML = UI_ICONS.sort;

  els.searchInput.addEventListener('input', () => cb.onSearchInput(els.searchInput.value));

  els.btnSort.addEventListener('click', (e) => {
    e.stopPropagation();
    els.sortMenu.classList.toggle('open');
  });
  document.addEventListener('click', () => els.sortMenu.classList.remove('open'));

  for (const btn of els.sortMenu.querySelectorAll('button')) {
    btn.textContent = SORT_LABELS[btn.dataset.sort];
    btn.addEventListener('click', () => {
      cb.onSortSelect(btn.dataset.sort);
      els.sortMenu.classList.remove('open');
    });
  }
}

function renderFolderChips(state) {
  els.folderChips.innerHTML = '';
  const makeChip = (id, label) => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (state.filterFolderId === id ? ' active' : '');
    chip.textContent = label;
    chip.addEventListener('click', () => cb.onFilterFolder(id));
    return chip;
  };
  els.folderChips.appendChild(makeChip('all', 'すべて'));
  els.folderChips.appendChild(makeChip('none', '未分類'));
  for (const folder of state.folders) {
    els.folderChips.appendChild(makeChip(folder.id, folder.name));
  }
  const newChip = document.createElement('button');
  newChip.className = 'chip new';
  newChip.textContent = '+ 新規フォルダ';
  newChip.addEventListener('click', () => cb.onManageFolders());
  els.folderChips.appendChild(newChip);
}

function matchesSearch(recipe, search) {
  if (!search) return true;
  const q = search.toLowerCase();
  return (recipe.title || '').toLowerCase().includes(q) || (recipe.storeName || '').toLowerCase().includes(q);
}

function matchesFolder(recipe, filterFolderId) {
  if (filterFolderId === 'all') return true;
  if (filterFolderId === 'none') return recipe.folderId == null;
  return recipe.folderId === filterFolderId;
}

export function renderList(state) {
  els.searchInput.value = state.search;
  for (const btn of els.sortMenu.querySelectorAll('button')) {
    btn.classList.toggle('selected', btn.dataset.sort === state.sortMode);
  }
  renderFolderChips(state);

  let visible = state.recipes.filter((r) => matchesSearch(r, state.search) && matchesFolder(r, state.filterFolderId));
  visible = sortRecipes(visible, state.sortMode);

  els.recipeList.innerHTML = '';
  els.emptyState.hidden = state.recipes.length > 0;
  if (visible.length === 0 && state.recipes.length > 0) {
    const p = document.createElement('p');
    p.className = 'card-meta';
    p.textContent = '該当するレシピが見つかりません。';
    els.recipeList.appendChild(p);
    return;
  }

  for (const recipe of visible) {
    const card = document.createElement('button');
    card.className = 'recipe-card';
    card.type = 'button';
    card.addEventListener('click', () => cb.onOpenRecipe(recipe.id));

    const thumb = document.createElement('div');
    thumb.className = 'recipe-card__thumb';
    if (recipe.photo) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(recipe.photo);
      img.alt = '';
      thumb.appendChild(img);
    } else {
      thumb.innerHTML = iconMarkup(recipe.icon || 'utensils');
    }

    const body = document.createElement('div');
    body.className = 'recipe-card__body';
    const title = document.createElement('p');
    title.className = 'card-title';
    title.textContent = recipe.title;
    const metaRow = document.createElement('div');
    metaRow.className = 'recipe-card__meta-row';
    if (recipe.storeName) {
      const s = document.createElement('span');
      s.className = 'card-meta';
      s.textContent = recipe.storeName;
      metaRow.appendChild(s);
    }
    if (recipe.cookingMinutes != null) {
      const t = document.createElement('span');
      t.className = 'card-meta';
      t.textContent = `${recipe.cookingMinutes}分`;
      metaRow.appendChild(t);
    }
    body.append(title, metaRow);

    card.append(thumb, body);
    els.recipeList.appendChild(card);
  }
}

export { formatIngredient };
