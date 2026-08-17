import { getGeminiApiKey, setGeminiApiKey, getGeminiModel, setGeminiModel, getCorsProxyUrl, setCorsProxyUrl } from '../data/settings.js';
import { DEFAULT_CORS_PROXY } from '../features/urlImport.js';
import { showToast } from '../utils/toast.js';

const els = {};

function q(id) { return document.getElementById(id); }

export function initSettings() {
  els.geminiKey = q('settingsGeminiKey');
  els.geminiModel = q('settingsGeminiModel');
  els.corsProxy = q('settingsCorsProxy');
  els.btnSave = q('btnSaveSettings');
  els.savedNote = q('settingsSavedNote');

  els.btnSave.addEventListener('click', () => {
    setGeminiApiKey(els.geminiKey.value.trim());
    setGeminiModel(els.geminiModel.value.trim());
    setCorsProxyUrl(els.corsProxy.value.trim() || DEFAULT_CORS_PROXY);
    els.savedNote.hidden = false;
    showToast('設定を保存しました');
    setTimeout(() => { els.savedNote.hidden = true; }, 2000);
  });
}

export function renderSettings() {
  els.geminiKey.value = getGeminiApiKey();
  els.geminiModel.value = getGeminiModel();
  els.corsProxy.value = getCorsProxyUrl(DEFAULT_CORS_PROXY);
  els.savedNote.hidden = true;
}
