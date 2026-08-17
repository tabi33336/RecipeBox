import { bindAutosize, autosize } from '../utils/autoExpand.js';
import { applyAutoUnit } from '../features/unitSuggest.js';
import { applyAutoCookingMinutes } from '../features/cookingTime.js';
import { importRecipeFromUrl, DEFAULT_CORS_PROXY } from '../features/urlImport.js';
import { guessRecipeFromPhoto } from '../features/aiGuess.js';
import { getGeminiApiKey, getGeminiModel, getCorsProxyUrl } from '../data/settings.js';
import { iconMarkup, ICON_KEYS, UI_ICONS } from '../icons.js';
import { genId } from '../data/db.js';

const els = {};
let currentIcon = 'utensils';
let currentPhotoBlob = null;
let importedSourceURL = null;
let selectedFolderId = null;
let lastAutoCookingMinutes = null;
let folders = [];

function q(id) { return document.getElementById(id); }

export function initEdit() {
  els.importUrl = q('editImportUrl');
  els.btnImportUrl = q('btnImportUrl');
  els.importStatus = q('importStatus');
  els.photoUpload = q('photoUpload');
  els.photoInput = q('editPhotoInput');
  els.photoPreview = q('editPhotoPreview');
  els.photoPlaceholder = q('photoPlaceholder');
  els.btnRemovePhoto = q('btnRemovePhoto');
  els.iconPicker = q('iconPicker');
  els.btnAiGuess = q('btnAiGuess');
  els.aiGuessStatus = q('aiGuessStatus');
  els.title = q('editTitle');
  els.store = q('editStore');
  els.cookingMinutes = q('editCookingMinutes');
  els.cookingAutoHint = q('cookingAutoHint');
  els.folderChips = q('editFolderChips');
  els.ingredientRows = q('ingredientRows');
  els.stepRows = q('stepRows');
  els.memo = q('editMemo');
  els.btnAddIngredient = q('btnAddIngredient');
  els.btnAddStep = q('btnAddStep');

  els.btnAddIngredient.innerHTML = `${UI_ICONS.plus} 材料を追加`;
  els.btnAddStep.innerHTML = `${UI_ICONS.plus} 手順を追加`;
  els.photoPlaceholder.innerHTML = UI_ICONS.camera;
  els.btnAiGuess.innerHTML = `${UI_ICONS.sparkle} 写真からAIでレシピを推測`;

  els.iconPicker.innerHTML = '';
  for (const key of ICON_KEYS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = iconMarkup(key);
    btn.dataset.icon = key;
    btn.addEventListener('click', () => {
      currentIcon = key;
      renderIconPicker();
    });
    els.iconPicker.appendChild(btn);
  }

  els.photoUpload.addEventListener('click', () => els.photoInput.click());
  els.photoInput.addEventListener('change', () => {
    const file = els.photoInput.files[0];
    if (!file) return;
    currentPhotoBlob = file;
    renderPhotoPreview();
  });
  els.btnRemovePhoto.addEventListener('click', (e) => {
    e.stopPropagation();
    currentPhotoBlob = null;
    els.photoInput.value = '';
    renderPhotoPreview();
  });

  els.cookingMinutes.addEventListener('input', () => {
    updateCookingHint();
  });

  els.btnAddIngredient.addEventListener('click', () => addIngredientRow());
  els.btnAddStep.addEventListener('click', () => addStepRow());

  els.btnImportUrl.addEventListener('click', handleUrlImport);
  els.btnAiGuess.addEventListener('click', handleAiGuess);

  bindAutosize(els.title);
  bindAutosize(els.store);
}

function renderIconPicker() {
  for (const btn of els.iconPicker.children) {
    btn.classList.toggle('selected', btn.dataset.icon === currentIcon);
  }
}

function renderPhotoPreview() {
  if (currentPhotoBlob) {
    els.photoPreview.src = URL.createObjectURL(currentPhotoBlob);
    els.photoPreview.hidden = false;
    els.photoPlaceholder.hidden = true;
    els.btnRemovePhoto.hidden = false;
  } else {
    els.photoPreview.hidden = true;
    els.photoPreview.src = '';
    els.photoPlaceholder.hidden = false;
    els.btnRemovePhoto.hidden = true;
  }
}

function renderFolderChips() {
  els.folderChips.innerHTML = '';
  const makeChip = (id, label) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (selectedFolderId === id ? ' active' : '');
    chip.textContent = label;
    chip.addEventListener('click', () => {
      selectedFolderId = id;
      renderFolderChips();
    });
    return chip;
  };
  els.folderChips.appendChild(makeChip(null, '未分類'));
  for (const folder of folders) {
    els.folderChips.appendChild(makeChip(folder.id, folder.name));
  }
  const newChip = document.createElement('button');
  newChip.type = 'button';
  newChip.className = 'chip new';
  newChip.textContent = '+ 新規フォルダ';
  newChip.addEventListener('click', () => {
    const name = window.prompt('新しいフォルダ名を入力してください');
    if (!name || !name.trim()) return;
    const folder = { id: genId(), name: name.trim(), createdAt: Date.now() };
    import('../data/db.js').then(({ putFolder }) => putFolder(folder)).then(() => {
      folders = [...folders, folder];
      selectedFolderId = folder.id;
      renderFolderChips();
    });
  });
  els.folderChips.appendChild(newChip);
}

function updateCookingHint() {
  const isAuto = lastAutoCookingMinutes !== null && els.cookingMinutes.value === lastAutoCookingMinutes;
  els.cookingAutoHint.hidden = !isAuto;
}

function recalcCookingMinutesFromSteps() {
  const steps = collectStepTexts();
  const result = applyAutoCookingMinutes(els.cookingMinutes.value, lastAutoCookingMinutes, steps);
  els.cookingMinutes.value = result.text;
  lastAutoCookingMinutes = result.lastAutoText;
  updateCookingHint();
}

function collectStepTexts() {
  return Array.from(els.stepRows.querySelectorAll('textarea')).map((t) => t.value);
}

function renumberSteps() {
  Array.from(els.stepRows.children).forEach((row, i) => {
    row.querySelector('.index').textContent = String(i + 1);
  });
}

function addIngredientRow(ingredient) {
  const data = ingredient || { name: '', amount: '', unit: '' };
  const row = document.createElement('div');
  row.className = 'ingredient-row';

  const nameField = document.createElement('div');
  nameField.className = 'field name-field';
  const nameInput = document.createElement('textarea');
  nameInput.className = 'autosize';
  nameInput.rows = 1;
  nameInput.placeholder = '材料名';
  nameInput.value = data.name;
  nameField.appendChild(nameInput);

  const amountField = document.createElement('div');
  amountField.className = 'field amount-field';
  const amountInput = document.createElement('input');
  amountInput.type = 'text';
  amountInput.placeholder = '分量';
  amountInput.value = data.amount;
  amountField.appendChild(amountInput);

  const unitField = document.createElement('div');
  unitField.className = 'field unit-field';
  const unitInput = document.createElement('input');
  unitInput.type = 'text';
  unitInput.placeholder = '単位';
  unitInput.value = data.unit;
  unitField.appendChild(unitInput);

  unitInput._lastAutoUnit = null;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn btn-icon row-remove';
  removeBtn.innerHTML = UI_ICONS.close;
  removeBtn.addEventListener('click', () => row.remove());

  row.append(nameField, amountField, unitField, removeBtn);
  els.ingredientRows.appendChild(row);
  bindAutosize(nameInput);

  nameInput.addEventListener('input', () => {
    const result = applyAutoUnit(unitInput.value, unitInput._lastAutoUnit, nameInput.value);
    unitInput.value = result.unit;
    unitInput._lastAutoUnit = result.lastAutoUnit;
  });
}

function addStepRow(text) {
  const row = document.createElement('div');
  row.className = 'step-row';

  const index = document.createElement('div');
  index.className = 'index';
  index.textContent = String(els.stepRows.children.length + 1);

  const field = document.createElement('div');
  field.className = 'field';
  const textarea = document.createElement('textarea');
  textarea.className = 'autosize';
  textarea.rows = 1;
  textarea.placeholder = '手順を入力';
  textarea.value = text || '';
  field.appendChild(textarea);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn btn-icon row-remove';
  removeBtn.innerHTML = UI_ICONS.close;
  removeBtn.addEventListener('click', () => {
    row.remove();
    renumberSteps();
    recalcCookingMinutesFromSteps();
  });

  row.append(index, field, removeBtn);
  els.stepRows.appendChild(row);
  bindAutosize(textarea);

  textarea.addEventListener('input', () => recalcCookingMinutesFromSteps());
}

async function handleUrlImport() {
  const url = els.importUrl.value.trim();
  if (!url) return;
  els.importStatus.hidden = false;
  els.importStatus.textContent = '取り込み中...';
  els.btnImportUrl.disabled = true;
  try {
    const corsProxyUrl = getCorsProxyUrl(DEFAULT_CORS_PROXY);
    const result = await importRecipeFromUrl(url, corsProxyUrl);
    importedSourceURL = url;
    if (result && result.kind === 'structured') {
      if (result.title) {
        els.title.value = result.title;
        autosize(els.title);
      }
      if (result.ingredients && result.ingredients.length > 0) {
        els.ingredientRows.innerHTML = '';
        for (const raw of result.ingredients) {
          addIngredientRow({ name: raw, amount: '', unit: '' });
        }
      }
      if (result.steps && result.steps.length > 0) {
        els.stepRows.innerHTML = '';
        for (const step of result.steps) {
          addStepRow(step);
        }
        recalcCookingMinutesFromSteps();
      }
      if (result.photoBlob) {
        currentPhotoBlob = result.photoBlob;
        renderPhotoPreview();
      }
      els.importStatus.textContent = '取り込みました。内容を確認・修正してください。';
    } else if (result && result.kind === 'caption') {
      if (result.photoBlob) {
        currentPhotoBlob = result.photoBlob;
        renderPhotoPreview();
      }
      if (result.caption) {
        const note = `【取り込んだ投稿文】\n${result.caption}`;
        els.memo.value = els.memo.value.trim() ? `${els.memo.value}\n\n${note}` : note;
      }
      els.importStatus.textContent = 'このサイトは材料・手順の自動取得に対応していないため、写真と投稿文だけを取り込みました。メモ欄の投稿文を見ながら、料理名・材料・手順を手動で入力してください。';
    } else {
      els.importStatus.textContent = '構造化データが見つかりませんでした。URLはリンクとして保存されます。手動で入力してください。';
    }
  } catch (err) {
    importedSourceURL = url;
    els.importStatus.textContent = '取り込みに失敗しました。URLはリンクとして保存されます。手動で入力してください。';
  } finally {
    els.btnImportUrl.disabled = false;
  }
}

async function handleAiGuess() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    alert('設定画面でGemini APIキーを登録してください。');
    return;
  }
  if (!currentPhotoBlob) {
    alert('先に写真を選択してください。');
    return;
  }
  els.aiGuessStatus.hidden = false;
  els.aiGuessStatus.textContent = 'AIがレシピを推測しています...';
  els.btnAiGuess.disabled = true;
  try {
    const model = getGeminiModel();
    const result = await guessRecipeFromPhoto(currentPhotoBlob, apiKey, model);
    if (result.title) {
      els.title.value = result.title;
      autosize(els.title);
    }
    if (result.ingredients.length > 0) {
      els.ingredientRows.innerHTML = '';
      for (const ing of result.ingredients) addIngredientRow(ing);
    }
    if (result.steps.length > 0) {
      els.stepRows.innerHTML = '';
      for (const step of result.steps) addStepRow(step);
    }
    if (result.cookingMinutes != null) {
      els.cookingMinutes.value = String(result.cookingMinutes);
      lastAutoCookingMinutes = String(result.cookingMinutes);
      updateCookingHint();
    }
    els.aiGuessStatus.textContent = '推測しました。内容を確認・修正してください。';
  } catch (err) {
    els.aiGuessStatus.textContent = `推測に失敗しました: ${err.message}`;
  } finally {
    els.btnAiGuess.disabled = false;
  }
}

export function loadRecipeIntoForm(recipe, foldersList) {
  folders = foldersList || [];
  currentIcon = recipe?.icon || 'utensils';
  currentPhotoBlob = recipe?.photo || null;
  importedSourceURL = recipe?.sourceURL || null;
  selectedFolderId = recipe?.folderId ?? null;
  lastAutoCookingMinutes = null;

  els.importUrl.value = '';
  els.importStatus.hidden = true;
  els.aiGuessStatus.hidden = true;
  els.btnAiGuess.hidden = !getGeminiApiKey();

  els.title.value = recipe?.title || '';
  els.store.value = recipe?.storeName || '';
  els.cookingMinutes.value = recipe?.cookingMinutes != null ? String(recipe.cookingMinutes) : '';
  els.memo.value = recipe?.memo || '';

  autosize(els.title);
  autosize(els.store);

  renderIconPicker();
  renderPhotoPreview();
  renderFolderChips();
  updateCookingHint();

  els.ingredientRows.innerHTML = '';
  const ingredients = recipe?.ingredients?.length ? recipe.ingredients : [{ name: '', amount: '', unit: '' }];
  for (const ing of ingredients) addIngredientRow(ing);

  els.stepRows.innerHTML = '';
  const steps = recipe?.steps?.length ? recipe.steps : [''];
  for (const step of steps) addStepRow(step);
}

export function collectFormData() {
  const ingredients = Array.from(els.ingredientRows.children).map((row) => {
    const [nameInput, amountInput, unitInput] = [
      row.querySelector('.name-field textarea'),
      row.querySelector('.amount-field input'),
      row.querySelector('.unit-field input'),
    ];
    return { name: nameInput.value.trim(), amount: amountInput.value.trim(), unit: unitInput.value.trim() };
  }).filter((ing) => ing.name || ing.amount || ing.unit);

  const steps = Array.from(els.stepRows.querySelectorAll('textarea'))
    .map((t) => t.value.trim())
    .filter((s) => s !== '');

  const cookingMinutesValue = els.cookingMinutes.value.trim();

  return {
    title: els.title.value.trim(),
    storeName: els.store.value.trim(),
    ingredients,
    steps,
    memo: els.memo.value.trim(),
    photo: currentPhotoBlob,
    icon: currentIcon,
    sourceURL: importedSourceURL,
    cookingMinutes: cookingMinutesValue ? parseInt(cookingMinutesValue, 10) : null,
    folderId: selectedFolderId,
  };
}
