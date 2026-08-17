import { iconMarkup } from '../icons.js';
import { formatIngredient } from '../data/recipeUtils.js';

const els = {};

function q(id) { return document.getElementById(id); }

export function initDetail() {
  els.photo = q('detailPhoto');
  els.title = q('detailTitle');
  els.meta = q('detailMeta');
  els.ingredients = q('detailIngredients');
  els.steps = q('detailSteps');
  els.memoSection = q('detailMemoSection');
  els.memo = q('detailMemo');
  els.sourceLink = q('detailSourceLink');
}

export function renderDetail(recipe, folder) {
  els.photo.innerHTML = '';
  if (recipe.photo) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(recipe.photo);
    img.alt = '';
    els.photo.appendChild(img);
  } else {
    els.photo.innerHTML = iconMarkup(recipe.icon || 'utensils');
  }

  els.title.textContent = recipe.title;

  els.meta.innerHTML = '';
  if (recipe.storeName) {
    const span = document.createElement('span');
    span.textContent = `📍 ${recipe.storeName}`;
    els.meta.appendChild(span);
  }
  if (recipe.cookingMinutes != null) {
    const span = document.createElement('span');
    span.textContent = `⏱ ${recipe.cookingMinutes}分`;
    els.meta.appendChild(span);
  }
  if (folder) {
    const span = document.createElement('span');
    span.textContent = `📁 ${folder.name}`;
    els.meta.appendChild(span);
  }

  els.ingredients.innerHTML = '';
  for (const ing of recipe.ingredients) {
    const li = document.createElement('li');
    li.textContent = formatIngredient(ing);
    els.ingredients.appendChild(li);
  }

  els.steps.innerHTML = '';
  for (const step of recipe.steps) {
    const li = document.createElement('li');
    li.textContent = step;
    els.steps.appendChild(li);
  }

  if (recipe.memo) {
    els.memoSection.hidden = false;
    els.memo.textContent = recipe.memo;
  } else {
    els.memoSection.hidden = true;
  }

  if (recipe.sourceURL) {
    els.sourceLink.href = recipe.sourceURL;
    els.sourceLink.hidden = false;
  } else {
    els.sourceLink.hidden = true;
  }
}
