export function formatIngredient(ing) {
  const base = `${ing.name} ${ing.amount ?? ''}${ing.unit || ''}`.trim();
  return ing.optional ? `${base}（任意）` : base;
}

function isAmountBlank(amount) {
  if (amount == null) return true;
  if (typeof amount === 'number') return false;
  return !String(amount).trim();
}

export function isBlankIngredient(ing) {
  return !ing.name?.trim() && isAmountBlank(ing.amount) && !ing.unit?.trim();
}

export function filterBlankIngredients(ingredients) {
  return ingredients.filter((ing) => !isBlankIngredient(ing));
}

/**
 * Parses a free-text amount into a number when it's purely numeric or a
 * simple fraction (e.g. "2", "1.5", "1/2"). Non-numeric text (e.g. "少々",
 * "適量") is returned unchanged so it can still be stored and displayed.
 */
export function parseAmount(raw) {
  if (raw == null) return raw;
  if (typeof raw === 'number') return raw;
  const trimmed = String(raw).trim();
  if (trimmed === '') return '';
  const fraction = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const denom = parseInt(fraction[2], 10);
    if (denom !== 0) return parseInt(fraction[1], 10) / denom;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }
  return trimmed;
}

export const AMOUNT_PRESETS = ['少々', '適量', 'お好みで', 'ひとつまみ'];

export function filterBlankSteps(steps) {
  return steps.filter((s) => s.trim() !== '');
}

const SORTERS = {
  newest: (a, b) => b.createdAt - a.createdAt,
  oldest: (a, b) => a.createdAt - b.createdAt,
  titleAZ: (a, b) => (a.title || '').localeCompare(b.title || '', 'ja'),
  storeAZ: (a, b) => (a.storeName || '').localeCompare(b.storeName || '', 'ja'),
  cookingShort: (a, b) => byCookingTime(a, b, 1),
  cookingLong: (a, b) => byCookingTime(a, b, -1),
};

function byCookingTime(a, b, direction) {
  const av = a.cookingTime;
  const bv = b.cookingTime;
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  return (av - bv) * direction;
}

export function sortRecipes(recipes, sortMode) {
  const sorter = SORTERS[sortMode] || SORTERS.newest;
  return [...recipes].sort(sorter);
}

export const SORT_LABELS = {
  newest: '追加日（新しい順）',
  oldest: '追加日（古い順）',
  titleAZ: '名前順',
  storeAZ: '店舗名順',
  cookingShort: '調理時間（短い順）',
  cookingLong: '調理時間（長い順）',
};
