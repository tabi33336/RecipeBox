const KEYS = {
  geminiApiKey: 'recipe-book:geminiApiKey',
  geminiModel: 'recipe-book:geminiModel',
  corsProxyUrl: 'recipe-book:corsProxyUrl',
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
