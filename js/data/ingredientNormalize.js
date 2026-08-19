import { BUILTIN_INGREDIENT_ALIASES } from './ingredientAliases.js';

/**
 * Builds a variant-name -> canonical-name lookup. User-defined aliases are
 * applied after the built-in dictionary so they can override it.
 */
export function buildAliasMap(userAliases = []) {
  const map = new Map();
  for (const { canonicalName, variants } of BUILTIN_INGREDIENT_ALIASES) {
    map.set(canonicalName, canonicalName);
    for (const variant of variants) map.set(variant, canonicalName);
  }
  for (const { canonicalName, variants } of userAliases) {
    map.set(canonicalName, canonicalName);
    for (const variant of variants || []) map.set(variant, canonicalName);
  }
  return map;
}

export function normalizeIngredientName(name, aliasMap) {
  const trimmed = (name || '').trim();
  if (!trimmed) return trimmed;
  return aliasMap.get(trimmed) || trimmed;
}
