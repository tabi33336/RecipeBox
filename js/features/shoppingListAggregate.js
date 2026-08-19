import { normalizeIngredientName } from '../data/ingredientNormalize.js';

/**
 * Aggregates ingredients from every recipe referenced by `mealPlanEntries`
 * (already filtered to the desired date range by the caller) into shopping
 * list items. Ingredients are grouped by normalized name + unit; numeric
 * amounts within a group are summed, while non-numeric amounts (e.g. "少々")
 * are kept as separate lines (identical repeats are merged with a count
 * instead of literally being duplicated). Different units are never
 * converted, so the same ingredient in different units becomes separate
 * lines.
 */
export function aggregateIngredients(mealPlanEntries, recipes, aliasMap) {
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const groups = new Map();

  for (const entry of mealPlanEntries) {
    const recipe = recipeMap.get(entry.recipeId);
    if (!recipe) continue;
    for (const ing of recipe.ingredients || []) {
      const name = normalizeIngredientName(ing.name, aliasMap);
      if (!name) continue;
      const unit = (ing.unit || '').trim();
      const key = `${name}|${unit}`;
      if (!groups.has(key)) {
        groups.set(key, {
          name, unit, numericAmount: 0, hasNumeric: false, nonNumericLabels: [], allOptional: true, anyEntry: false,
        });
      }
      const group = groups.get(key);
      group.anyEntry = true;
      if (!ing.optional) group.allOptional = false;

      if (typeof ing.amount === 'number') {
        group.numericAmount += ing.amount;
        group.hasNumeric = true;
      } else if (ing.amount != null && String(ing.amount).trim() !== '') {
        group.nonNumericLabels.push(String(ing.amount).trim());
      }
    }
  }

  const items = [];
  for (const group of groups.values()) {
    if (group.hasNumeric) {
      items.push({
        name: group.name, amount: roundAmount(group.numericAmount), unit: group.unit,
        checked: false, manuallyAdded: false, optional: group.allOptional,
      });
    }

    const labelCounts = new Map();
    for (const label of group.nonNumericLabels) {
      labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
    }
    for (const [label, count] of labelCounts) {
      items.push({
        name: group.name, amount: label, unit: group.unit, checked: false, manuallyAdded: false,
        optional: group.allOptional, count: count > 1 ? count : undefined,
      });
    }

    if (!group.hasNumeric && labelCounts.size === 0 && group.anyEntry) {
      items.push({ name: group.name, amount: '', unit: group.unit, checked: false, manuallyAdded: false, optional: group.allOptional });
    }
  }

  items.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  return items;
}

function roundAmount(amount) {
  return Math.round(amount * 100) / 100;
}

export function formatShoppingItem(item) {
  let base = `${item.name} ${item.amount ?? ''}${item.unit || ''}`.trim();
  if (item.count && item.count > 1) base += ` ×${item.count}`;
  if (item.optional) base += '（任意）';
  return base;
}
