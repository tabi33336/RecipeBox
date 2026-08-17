export const UNIT_SUGGESTIONS = [
  { keywords: ['卵', 'たまご'], unit: '個' },
  { keywords: ['玉ねぎ', 'たまねぎ', 'じゃがいも', 'トマト', 'ピーマン'], unit: '個' },
  { keywords: ['にんじん', '人参', 'ねぎ', '長ねぎ', 'きゅうり', 'なす'], unit: '本' },
  { keywords: ['豆腐'], unit: '丁' },
  { keywords: ['しめじ', 'えのき', 'きのこ'], unit: 'パック' },
  { keywords: ['ひき肉', '挽き肉', '牛肉', '豚肉', '鶏肉', '肉', 'チーズ', 'パン粉'], unit: 'g' },
  { keywords: ['醤油', 'しょうゆ', 'みりん', '酒', '砂糖', '油', '味噌', 'みそ'], unit: '大さじ' },
  { keywords: ['塩', 'こしょう', '胡椒'], unit: '少々' },
  { keywords: ['牛乳', 'だし汁', '水', 'スープ'], unit: 'ml' },
  { keywords: ['生姜', 'しょうが', 'にんにく'], unit: 'かけ' },
];

export function suggestUnit(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  for (const entry of UNIT_SUGGESTIONS) {
    if (entry.keywords.some((kw) => trimmed.includes(kw))) {
      return entry.unit;
    }
  }
  return null;
}

/**
 * Guarded update: only overwrite the unit if it's empty or still equals the
 * last value this function auto-filled. Returns the new { unit, lastAutoUnit } state.
 */
export function applyAutoUnit(currentUnit, lastAutoUnit, ingredientName) {
  const suggested = suggestUnit(ingredientName);
  if (currentUnit !== '' && currentUnit !== lastAutoUnit) {
    return { unit: currentUnit, lastAutoUnit };
  }
  return { unit: suggested || '', lastAutoUnit: suggested };
}
