import { formatIngredient } from '../data/recipeUtils.js';

export function buildShareText(recipe) {
  const lines = [recipe.title];
  if (recipe.storeName) lines.push(`📍 ${recipe.storeName}`);
  if (recipe.cookingTime != null) lines.push(`⏱ ${recipe.cookingTime}分`);
  if (recipe.servings != null) lines.push(`👥 ${recipe.servings}人分`);
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    lines.push('', '【材料】');
    for (const ing of recipe.ingredients) {
      lines.push(formatIngredient(ing));
    }
  }
  if (recipe.steps && recipe.steps.length > 0) {
    lines.push('', '【作り方】');
    recipe.steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  }
  if (recipe.memo) {
    lines.push('', recipe.memo);
  }
  if (recipe.sourceUrl) {
    lines.push('', recipe.sourceUrl);
  }
  return lines.join('\n');
}

export async function shareRecipe(recipe) {
  const text = buildShareText(recipe);
  if (navigator.share) {
    try {
      await navigator.share({ title: recipe.title, text });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
      // fall through to clipboard on other errors
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
