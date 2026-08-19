import { bindAutosize, autosize } from '../utils/autoExpand.js';
import { applyAutoUnit } from '../features/unitSuggest.js';
import { applyAutoCookingMinutes } from '../features/cookingTime.js';
import { importRecipeFromUrl, fetchHtml, parseOgTagsFromHtml, DEFAULT_CORS_PROXY } from '../features/urlImport.js';
import { guessRecipeFromContext } from '../features/aiGuess.js';
import { getGeminiApiKey, getGeminiModel, getCorsProxyUrl } from '../data/settings.js';
import { iconMarkup, ICON_KEYS, UI_ICONS } from '../icons.js';
import { genId } from '../data/db.js';
import { isBlankIngredient, parseAmount, AMOUNT_PRESETS } from '../data/recipeUtils.js';
import { showImportResult } from '../utils/importResultDialog.js';

const els = {};
let currentIcon = 'utensils';
let currentPhotoBlob = null;
let aiGuessPhotoBlob = null;
let importedSourceURL = null;
let selectedFolderId = null;
let lastAutoCookingMinutes = null;
let folders = [];

function q(id) { return document.getElementById(id); }

export function initEdit() {
  els.chooser = q('editChooser');
  els.urlPanel = q('editUrlPanel');
  els.aiPanel = q('editAiPanel');
  els.form = q('editForm');
  els.btnUrlPanelBack = q('btnUrlPanelBack');
  els.btnAiPanelBack = q('btnAiPanelBack');

  els.importUrl = q('editImportUrl');
  els.btnImportUrl = q('btnImportUrl');
  els.importStatus = q('importStatus');
  els.photoUpload = q('photoUpload');
  els.photoInput = q('editPhotoInput');
  els.photoPreview = q('editPhotoPreview');
  els.photoPlaceholder = q('photoPlaceholder');
  els.btnRemovePhoto = q('btnRemovePhoto');
  els.iconPicker = q('iconPicker');

  els.aiGuessPhotoUpload = q('aiGuessPhotoUpload');
  els.aiGuessPhotoInput = q('aiGuessPhotoInput');
  els.aiGuessPhotoPreview = q('aiGuessPhotoPreview');
  els.aiGuessPhotoPlaceholder = q('aiGuessPhotoPlaceholder');
  els.btnAiGuessRemovePhoto = q('btnAiGuessRemovePhoto');
  els.aiGuessStoreName = q('aiGuessStoreName');
  els.aiGuessStoreUrl = q('aiGuessStoreUrl');
  els.aiGuessFreeText = q('aiGuessFreeText');
  els.btnRunAiGuess = q('btnRunAiGuess');
  els.aiGuessRunStatus = q('aiGuessRunStatus');
  els.aiGuessNoKeyHint = q('aiGuessNoKeyHint');

  els.title = q('editTitle');
  els.store = q('editStore');
  els.cookingMinutes = q('editCookingMinutes');
  els.cookingAutoHint = q('cookingAutoHint');
  els.servings = q('editServings');
  els.folderChips = q('editFolderChips');
  els.ingredientRows = q('ingredientRows');
  els.stepRows = q('stepRows');
  els.memo = q('editMemo');
  els.btnAddIngredient = q('btnAddIngredient');
  els.btnAddStep = q('btnAddStep');

  els.btnAddIngredient.innerHTML = `${UI_ICONS.plus} 材料を追加`;
  els.btnAddStep.innerHTML = `${UI_ICONS.plus} 手順を追加`;
  els.photoPlaceholder.innerHTML = UI_ICONS.camera;
  els.aiGuessPhotoPlaceholder.innerHTML = UI_ICONS.camera;
  els.btnRunAiGuess.innerHTML = `${UI_ICONS.sparkle} AIレシピ予測を実行`;
  q('chooserIconAi').innerHTML = UI_ICONS.sparkle;
  q('chooserIconUrl').innerHTML = UI_ICONS.link;
  q('chooserIconManual').innerHTML = UI_ICONS.edit;
  q('urlPanelBackIcon').innerHTML = UI_ICONS.back;
  q('aiPanelBackIcon').innerHTML = UI_ICONS.back;

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

  els.aiGuessPhotoUpload.addEventListener('click', () => els.aiGuessPhotoInput.click());
  els.aiGuessPhotoInput.addEventListener('change', () => {
    const file = els.aiGuessPhotoInput.files[0];
    if (!file) return;
    aiGuessPhotoBlob = file;
    renderAiGuessPhotoPreview();
  });
  els.btnAiGuessRemovePhoto.addEventListener('click', (e) => {
    e.stopPropagation();
    aiGuessPhotoBlob = null;
    els.aiGuessPhotoInput.value = '';
    renderAiGuessPhotoPreview();
  });

  els.cookingMinutes.addEventListener('input', () => {
    updateCookingHint();
  });

  els.btnAddIngredient.addEventListener('click', () => addIngredientRow());
  els.btnAddStep.addEventListener('click', () => addStepRow());

  els.btnImportUrl.addEventListener('click', handleUrlImport);
  els.btnRunAiGuess.addEventListener('click', handleRunAiGuess);

  for (const card of els.chooser.querySelectorAll('.edit-chooser__card')) {
    card.addEventListener('click', () => {
      const choice = card.dataset.choose;
      showEditStage(choice === 'manual' ? 'form' : choice);
    });
  }
  els.btnUrlPanelBack.addEventListener('click', () => showEditStage('chooser'));
  els.btnAiPanelBack.addEventListener('click', () => showEditStage('chooser'));

  bindAutosize(els.title);
  bindAutosize(els.store);
  bindAutosize(els.aiGuessFreeText);
}

function showEditStage(stage) {
  els.chooser.hidden = stage !== 'chooser';
  els.urlPanel.hidden = stage !== 'url';
  els.aiPanel.hidden = stage !== 'ai';
  els.form.hidden = stage !== 'form';
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

function renderAiGuessPhotoPreview() {
  if (aiGuessPhotoBlob) {
    els.aiGuessPhotoPreview.src = URL.createObjectURL(aiGuessPhotoBlob);
    els.aiGuessPhotoPreview.hidden = false;
    els.aiGuessPhotoPlaceholder.hidden = true;
    els.btnAiGuessRemovePhoto.hidden = false;
  } else {
    els.aiGuessPhotoPreview.hidden = true;
    els.aiGuessPhotoPreview.src = '';
    els.aiGuessPhotoPlaceholder.hidden = false;
    els.btnAiGuessRemovePhoto.hidden = true;
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
  const data = ingredient || { name: '', amount: '', unit: '', optional: false };
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
  amountInput.className = 'amount-input';
  amountInput.placeholder = '分量';
  amountInput.value = data.amount ?? '';
  amountField.appendChild(amountInput);

  const presetSelect = document.createElement('select');
  presetSelect.className = 'amount-preset';
  const placeholderOpt = document.createElement('option');
  placeholderOpt.value = '';
  placeholderOpt.textContent = '分量プリセット';
  presetSelect.appendChild(placeholderOpt);
  for (const preset of AMOUNT_PRESETS) {
    const opt = document.createElement('option');
    opt.value = preset;
    opt.textContent = preset;
    presetSelect.appendChild(opt);
  }
  presetSelect.addEventListener('change', () => {
    if (!presetSelect.value) return;
    amountInput.value = presetSelect.value;
    presetSelect.value = '';
  });
  amountField.appendChild(presetSelect);

  const unitField = document.createElement('div');
  unitField.className = 'field unit-field';
  const unitInput = document.createElement('input');
  unitInput.type = 'text';
  unitInput.placeholder = '単位';
  unitInput.value = data.unit;
  unitField.appendChild(unitInput);

  unitInput._lastAutoUnit = null;

  const optionalField = document.createElement('label');
  optionalField.className = 'optional-toggle';
  const optionalCheckbox = document.createElement('input');
  optionalCheckbox.type = 'checkbox';
  optionalCheckbox.className = 'optional-checkbox';
  optionalCheckbox.checked = !!data.optional;
  const optionalLabel = document.createElement('span');
  optionalLabel.textContent = '任意';
  optionalField.append(optionalCheckbox, optionalLabel);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn btn-icon row-remove';
  removeBtn.innerHTML = UI_ICONS.close;
  removeBtn.addEventListener('click', () => row.remove());

  row.append(nameField, amountField, unitField, optionalField, removeBtn);
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
      els.importStatus.hidden = true;
      const hasIngredients = result.ingredients && result.ingredients.length > 0;
      const hasSteps = result.steps && result.steps.length > 0;
      if (hasIngredients && hasSteps) {
        showImportResult({
          success: true,
          title: '取り込み完了',
          message: '材料と作り方を取り込みました。内容を確認してください。',
        });
      } else {
        showImportResult({
          success: false,
          title: '一部のみ取り込みました',
          message: hasIngredients
            ? '材料は取り込めましたが、作り方は取得できませんでした。手動で入力してください。'
            : '作り方は取り込めましたが、材料は取得できませんでした。手動で入力してください。',
        });
      }
    } else if (result && result.kind === 'caption') {
      if (result.photoBlob) {
        currentPhotoBlob = result.photoBlob;
        renderPhotoPreview();
      }
      if (result.caption) {
        const note = `【取り込んだ投稿文】\n${result.caption}`;
        els.memo.value = els.memo.value.trim() ? `${els.memo.value}\n\n${note}` : note;
      }
      els.importStatus.hidden = true;
      showImportResult({
        success: false,
        title: '一部のみ取り込みました',
        message: 'このサイトからは材料・作り方を自動取得できませんでした（会員限定コンテンツの場合や、このアプリが対応していないサイトの可能性があります）。写真と本文をメモ欄に取り込んだので、内容を確認しながら料理名・材料・作り方を手動で入力してください。',
      });
    } else {
      els.importStatus.hidden = true;
      showImportResult({
        success: false,
        title: '取り込めませんでした',
        message: 'このURLからレシピ情報を取得できませんでした。URLはリンクとして保存されるので、手動で入力してください。',
      });
    }
  } catch (err) {
    importedSourceURL = url;
    els.importStatus.hidden = true;
    showImportResult({
      success: false,
      title: '取り込みに失敗しました',
      message: `通信エラーが発生しました（${err.message}）。URLはリンクとして保存されるので、手動で入力してください。`,
    });
  } finally {
    els.btnImportUrl.disabled = false;
    showEditStage('form');
  }
}

async function fetchStoreWebsiteContext(url) {
  try {
    const corsProxyUrl = getCorsProxyUrl(DEFAULT_CORS_PROXY);
    const html = await fetchHtml(url, corsProxyUrl);
    const og = parseOgTagsFromHtml(html);
    if (!og) return '';
    return [og.title, og.description].filter(Boolean).join('\n');
  } catch {
    return '';
  }
}

async function handleRunAiGuess() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    alert('設定画面の「AI機能」でGemini APIキーを登録してください。');
    return;
  }
  const storeName = els.aiGuessStoreName.value.trim();
  const storeUrl = els.aiGuessStoreUrl.value.trim();
  const freeText = els.aiGuessFreeText.value.trim();
  if (!aiGuessPhotoBlob && !storeName && !storeUrl && !freeText) {
    alert('写真・店舗名・店舗WEBサイト・補足情報のいずれか1つ以上を入力してください。');
    return;
  }

  els.aiGuessRunStatus.hidden = false;
  els.aiGuessRunStatus.textContent = 'AIがレシピを推測しています...';
  els.btnRunAiGuess.disabled = true;
  try {
    let storeInfo = '';
    if (storeUrl) {
      els.aiGuessRunStatus.textContent = '店舗WEBサイトを確認しています...';
      storeInfo = await fetchStoreWebsiteContext(storeUrl);
      els.aiGuessRunStatus.textContent = 'AIがレシピを推測しています...';
    }

    const model = getGeminiModel();
    const result = await guessRecipeFromContext(
      { photoBlob: aiGuessPhotoBlob, storeName, storeInfo, freeText },
      apiKey,
      model
    );

    if (result.title) {
      els.title.value = result.title;
      autosize(els.title);
    }
    if (storeName) {
      els.store.value = storeName;
      autosize(els.store);
    }
    if (aiGuessPhotoBlob) {
      currentPhotoBlob = aiGuessPhotoBlob;
      renderPhotoPreview();
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
    els.aiGuessRunStatus.hidden = true;
    showEditStage('form');
  } catch (err) {
    els.aiGuessRunStatus.textContent = `推測に失敗しました: ${err.message}`;
  } finally {
    els.btnRunAiGuess.disabled = false;
  }
}

export function loadRecipeIntoForm(recipe, foldersList) {
  folders = foldersList || [];
  currentIcon = recipe?.icon || 'utensils';
  currentPhotoBlob = recipe?.image || null;
  aiGuessPhotoBlob = null;
  importedSourceURL = recipe?.sourceUrl || null;
  selectedFolderId = recipe?.folderId ?? null;
  lastAutoCookingMinutes = null;

  showEditStage(recipe ? 'form' : 'chooser');
  els.importUrl.value = '';
  els.importStatus.hidden = true;

  els.aiGuessStoreName.value = '';
  els.aiGuessStoreUrl.value = '';
  els.aiGuessFreeText.value = '';
  els.aiGuessRunStatus.hidden = true;
  els.aiGuessPhotoInput.value = '';
  renderAiGuessPhotoPreview();
  els.aiGuessNoKeyHint.hidden = !!getGeminiApiKey();
  els.btnRunAiGuess.hidden = !getGeminiApiKey();

  els.title.value = recipe?.title || '';
  els.store.value = recipe?.storeName || '';
  els.cookingMinutes.value = recipe?.cookingTime != null ? String(recipe.cookingTime) : '';
  els.servings.value = recipe?.servings != null ? String(recipe.servings) : '';
  els.memo.value = recipe?.memo || '';

  autosize(els.title);
  autosize(els.store);

  renderIconPicker();
  renderPhotoPreview();
  renderFolderChips();
  updateCookingHint();

  els.ingredientRows.innerHTML = '';
  const ingredients = recipe?.ingredients?.length ? recipe.ingredients : [{ name: '', amount: '', unit: '', optional: false }];
  for (const ing of ingredients) addIngredientRow(ing);

  els.stepRows.innerHTML = '';
  const steps = recipe?.steps?.length ? recipe.steps : [''];
  for (const step of steps) addStepRow(step);
}

export function collectFormData() {
  const ingredients = Array.from(els.ingredientRows.children).map((row) => {
    const [nameInput, amountInput, unitInput, optionalCheckbox] = [
      row.querySelector('.name-field textarea'),
      row.querySelector('.amount-input'),
      row.querySelector('.unit-field input'),
      row.querySelector('.optional-checkbox'),
    ];
    return {
      name: nameInput.value.trim(),
      amount: parseAmount(amountInput.value.trim()),
      unit: unitInput.value.trim(),
      optional: optionalCheckbox.checked,
    };
  }).filter((ing) => !isBlankIngredient(ing));

  const steps = Array.from(els.stepRows.querySelectorAll('textarea'))
    .map((t) => t.value.trim())
    .filter((s) => s !== '');

  const cookingMinutesValue = els.cookingMinutes.value.trim();
  const servingsValue = els.servings.value.trim();

  return {
    title: els.title.value.trim(),
    storeName: els.store.value.trim(),
    ingredients,
    steps,
    memo: els.memo.value.trim(),
    image: currentPhotoBlob,
    icon: currentIcon,
    sourceUrl: importedSourceURL,
    cookingTime: cookingMinutesValue ? parseInt(cookingMinutesValue, 10) : null,
    servings: servingsValue ? parseInt(servingsValue, 10) : null,
    folderId: selectedFolderId,
  };
}
