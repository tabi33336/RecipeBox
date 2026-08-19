import { getGeminiApiKey, setGeminiApiKey, getGeminiModel, setGeminiModel, getCorsProxyUrl, setCorsProxyUrl, getSyncLastPushedAt, getSyncLastPulledAt } from '../data/settings.js';
import { DEFAULT_CORS_PROXY } from '../features/urlImport.js';
import { generateSyncCode, startSync, stopSync, fullSync, isSyncEnabled, getSyncCode, getSyncWorkerUrl, pushChanges, pushDeletion } from '../data/sync.js';
import { renderQrCode } from '../features/qrCode.js';
import { getAllUserIngredientAliases, putUserIngredientAlias, deleteUserIngredientAlias, genId } from '../data/db.js';
import { confirmDialog } from '../utils/confirmDialog.js';
import { showToast } from '../utils/toast.js';
import { reportSyncError } from '../utils/syncFeedback.js';
import { UI_ICONS } from '../icons.js';

const els = {};
let onSyncDataChanged = () => {};
let aliasesCache = [];

function q(id) { return document.getElementById(id); }

export function initSettings(syncDataChangedCallback) {
  onSyncDataChanged = syncDataChangedCallback || onSyncDataChanged;

  els.geminiKey = q('settingsGeminiKey');
  els.geminiModel = q('settingsGeminiModel');
  els.corsProxy = q('settingsCorsProxy');
  els.btnSave = q('btnSaveSettings');
  els.savedNote = q('settingsSavedNote');

  els.syncNotConnected = q('syncNotConnected');
  els.syncConnected = q('syncConnected');
  els.syncWorkerUrl = q('settingsSyncWorkerUrl');
  els.btnStartSync = q('btnStartSync');
  els.joinSyncCodeInput = q('joinSyncCodeInput');
  els.btnJoinSync = q('btnJoinSync');
  els.syncQrCode = q('syncQrCode');
  els.syncCodeText = q('syncCodeText');
  els.btnCopySyncCode = q('btnCopySyncCode');
  els.syncLastSyncedText = q('syncLastSyncedText');
  els.btnSyncNow = q('btnSyncNow');
  els.btnStopSync = q('btnStopSync');
  els.syncStatus = q('syncStatus');

  els.aliasList = q('aliasList');
  els.aliasCanonicalInput = q('aliasCanonicalInput');
  els.aliasVariantsInput = q('aliasVariantsInput');
  els.btnAddAlias = q('btnAddAlias');
  els.btnAddAlias.addEventListener('click', handleAddAlias);

  els.btnSave.addEventListener('click', () => {
    setGeminiApiKey(els.geminiKey.value.trim());
    setGeminiModel(els.geminiModel.value.trim());
    setCorsProxyUrl(els.corsProxy.value.trim() || DEFAULT_CORS_PROXY);
    els.savedNote.hidden = false;
    showToast('設定を保存しました');
    setTimeout(() => { els.savedNote.hidden = true; }, 2000);
  });

  els.btnStartSync.addEventListener('click', () => beginSync(generateSyncCode()));
  els.btnJoinSync.addEventListener('click', () => {
    const code = els.joinSyncCodeInput.value.trim().toUpperCase();
    if (!code) { showSyncStatus('同期コードを入力してください。'); return; }
    beginSync(code);
  });

  els.btnCopySyncCode.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(getSyncCode());
      showToast('同期コードをコピーしました');
    } catch {
      showToast('コピーに失敗しました');
    }
  });

  els.btnSyncNow.addEventListener('click', async () => {
    els.btnSyncNow.disabled = true;
    showSyncStatus('同期しています...');
    try {
      const result = await fullSync();
      showSyncStatus(`同期しました（送信 ${result.pushed} 件 / 受信 ${result.pulled} 件）`);
      renderSyncSection();
      onSyncDataChanged();
    } catch (err) {
      showSyncStatus(`同期に失敗しました（${err.message}）`);
    } finally {
      els.btnSyncNow.disabled = false;
    }
  });

  els.btnStopSync.addEventListener('click', async () => {
    const ok = await confirmDialog('同期を解除しますか？この端末のデータはそのまま残りますが、他の端末とのデータ共有は停止します。', '解除する');
    if (!ok) return;
    stopSync();
    renderSyncSection();
    showToast('同期を解除しました');
  });
}

function showSyncStatus(message) {
  els.syncStatus.textContent = message;
  els.syncStatus.hidden = false;
}

async function beginSync(code) {
  const workerUrl = els.syncWorkerUrl.value.trim();
  if (!workerUrl) { showSyncStatus('同期サーバーURLを入力してください。'); return; }
  els.btnStartSync.disabled = true;
  els.btnJoinSync.disabled = true;
  showSyncStatus('同期を開始しています...');
  try {
    const result = await startSync(code, workerUrl);
    showSyncStatus(`同期を開始しました（送信 ${result.pushed} 件 / 受信 ${result.pulled} 件）`);
    renderSyncSection();
    onSyncDataChanged();
  } catch (err) {
    showSyncStatus(`同期の開始に失敗しました（${err.message}）。同期サーバーURLを確認してください。`);
    renderSyncSection();
  } finally {
    els.btnStartSync.disabled = false;
    els.btnJoinSync.disabled = false;
  }
}

function formatSyncTime(ts) {
  return ts > 0 ? new Date(ts).toLocaleString('ja-JP') : '未同期';
}

function renderSyncSection() {
  const enabled = isSyncEnabled();
  els.syncNotConnected.hidden = enabled;
  els.syncConnected.hidden = !enabled;
  els.syncStatus.hidden = true;

  if (enabled) {
    els.syncWorkerUrl.value = getSyncWorkerUrl();
    els.syncCodeText.textContent = getSyncCode();
    els.syncQrCode.innerHTML = '';
    els.syncQrCode.appendChild(renderQrCode(getSyncCode()));
    const lastSynced = Math.max(getSyncLastPushedAt(), getSyncLastPulledAt());
    els.syncLastSyncedText.textContent = `最終同期: ${formatSyncTime(lastSynced)}`;
  } else {
    els.syncWorkerUrl.value = getSyncWorkerUrl();
    els.joinSyncCodeInput.value = '';
  }
}

async function handleAddAlias() {
  const canonicalName = els.aliasCanonicalInput.value.trim();
  const variants = els.aliasVariantsInput.value.split(',').map((v) => v.trim()).filter(Boolean);
  if (!canonicalName || variants.length === 0) {
    showToast('代表名と別名の両方を入力してください');
    return;
  }
  const alias = { id: genId(), canonicalName, variants, createdAt: Date.now() };
  const saved = await putUserIngredientAlias(alias);
  aliasesCache = [...aliasesCache, saved];
  els.aliasCanonicalInput.value = '';
  els.aliasVariantsInput.value = '';
  renderAliasList();
  pushChanges().catch(reportSyncError);
}

async function handleRemoveAlias(id) {
  await deleteUserIngredientAlias(id);
  aliasesCache = aliasesCache.filter((a) => a.id !== id);
  renderAliasList();
  pushDeletion('userIngredientAlias', id).catch(reportSyncError);
}

function renderAliasList() {
  els.aliasList.innerHTML = '';
  if (aliasesCache.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'card-meta';
    empty.textContent = '追加した表記ゆれはまだありません。';
    els.aliasList.appendChild(empty);
    return;
  }
  for (const alias of aliasesCache) {
    const row = document.createElement('div');
    row.className = 'alias-row';
    const text = document.createElement('span');
    text.className = 'alias-row__text';
    text.append(`${alias.canonicalName} `);
    const variantsSpan = document.createElement('span');
    variantsSpan.className = 'alias-row__variants';
    variantsSpan.textContent = `= ${alias.variants.join(', ')}`;
    text.appendChild(variantsSpan);
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-icon';
    removeBtn.innerHTML = UI_ICONS.close;
    removeBtn.addEventListener('click', () => handleRemoveAlias(alias.id));
    row.append(text, removeBtn);
    els.aliasList.appendChild(row);
  }
}

export async function renderSettings() {
  els.geminiKey.value = getGeminiApiKey();
  els.geminiModel.value = getGeminiModel();
  els.corsProxy.value = getCorsProxyUrl(DEFAULT_CORS_PROXY);
  els.savedNote.hidden = true;
  renderSyncSection();
  aliasesCache = await getAllUserIngredientAliases();
  renderAliasList();
}
