const KEYS = {
  geminiApiKey: 'recipe-book:geminiApiKey',
  geminiModel: 'recipe-book:geminiModel',
  corsProxyUrl: 'recipe-book:corsProxyUrl',
  syncCode: 'recipe-book:syncCode',
  syncWorkerUrl: 'recipe-book:syncWorkerUrl',
  syncLastPushedAt: 'recipe-book:syncLastPushedAt',
  syncLastPulledAt: 'recipe-book:syncLastPulledAt',
  syncImageVersions: 'recipe-book:syncImageVersions',
};

// "-latest" alias: Google hot-swaps this to whichever current Flash model
// is recommended, so it keeps working as older dated models get deprecated
// (e.g. gemini-2.0-flash was retired) without needing a code/setting update.
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';

export function getGeminiApiKey() {
  return localStorage.getItem(KEYS.geminiApiKey) || '';
}

export function setGeminiApiKey(value) {
  localStorage.setItem(KEYS.geminiApiKey, value);
}

export function getGeminiModel() {
  return localStorage.getItem(KEYS.geminiModel) || DEFAULT_GEMINI_MODEL;
}

export function setGeminiModel(value) {
  localStorage.setItem(KEYS.geminiModel, value || DEFAULT_GEMINI_MODEL);
}

export function getCorsProxyUrl(defaultValue) {
  return localStorage.getItem(KEYS.corsProxyUrl) || defaultValue;
}

export function setCorsProxyUrl(value) {
  localStorage.setItem(KEYS.corsProxyUrl, value);
}

// --- 複数端末同期（端末固有の設定。同期対象そのものには含めない） ---

export function getSyncCode() {
  return localStorage.getItem(KEYS.syncCode) || '';
}

export function setSyncCode(value) {
  if (value) localStorage.setItem(KEYS.syncCode, value);
  else localStorage.removeItem(KEYS.syncCode);
}

export function getSyncWorkerUrl() {
  return localStorage.getItem(KEYS.syncWorkerUrl) || '';
}

export function setSyncWorkerUrl(value) {
  localStorage.setItem(KEYS.syncWorkerUrl, value || '');
}

export function isSyncEnabled() {
  return !!(getSyncCode() && getSyncWorkerUrl());
}

export function getSyncLastPushedAt() {
  return parseInt(localStorage.getItem(KEYS.syncLastPushedAt), 10) || 0;
}

export function setSyncLastPushedAt(value) {
  localStorage.setItem(KEYS.syncLastPushedAt, String(value));
}

export function getSyncLastPulledAt() {
  return parseInt(localStorage.getItem(KEYS.syncLastPulledAt), 10) || 0;
}

export function setSyncLastPulledAt(value) {
  localStorage.setItem(KEYS.syncLastPulledAt, String(value));
}

/** Map of recipeId -> updatedAt of the image version last uploaded, to avoid re-uploading unchanged photos. */
export function getSyncImageVersions() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.syncImageVersions) || '{}');
  } catch {
    return {};
  }
}

export function setSyncImageVersions(map) {
  localStorage.setItem(KEYS.syncImageVersions, JSON.stringify(map));
}

export function clearSyncSettings() {
  localStorage.removeItem(KEYS.syncCode);
  localStorage.removeItem(KEYS.syncWorkerUrl);
  localStorage.removeItem(KEYS.syncLastPushedAt);
  localStorage.removeItem(KEYS.syncLastPulledAt);
  localStorage.removeItem(KEYS.syncImageVersions);
}
