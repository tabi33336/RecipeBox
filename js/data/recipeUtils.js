export function formatIngredient(ing) {
  return `${ing.name} ${ing.amount || ''}${ing.unit || ''}`.trim();
}

export function isBlankIngredient(ing) {
  return !ing.name?.trim() && !ing.amount?.trim() && !ing.unit?.trim();
}

export function filterBlankIngredients(ingredients) {
  return ingredients.filter((ing) => !isBlankIngredient(ing));
}

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
  const av = a.cookingMinutes;
  const bv = b.cookingMinutes;
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
