import { importRecipeFromUrl } from './urlImport.js';
import { estimateMinutesFromSteps } from './cookingTime.js';
import { filterBlankIngredients, filterBlankSteps } from '../data/recipeUtils.js';
import { putRecipe, genId } from '../data/db.js';

export function parseUrlList(text) {
  return (text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^https?:\/\//i.test(line));
}

/**
 * Imports recipes from a list of URLs one at a time, saving each directly as
 * a new recipe. Mirrors the single-URL import in edit.js, but there's no
 * single edit form to fill in for N recipes, so each result is written to
 * the DB immediately instead of being returned for a form to consume.
 */
export async function bulkImportRecipes(urls, corsProxyUrl, onProgress) {
  const results = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    onProgress?.(i, urls.length, url);
    try {
      const parsed = await importRecipeFromUrl(url, corsProxyUrl);
      if (!parsed || parsed.kind !== 'structured') {
        results.push({ url, status: 'failed' });
        continue;
      }
      const ingredients = filterBlankIngredients(
        (parsed.ingredients || []).map((raw) => ({ name: raw, amount: '', unit: '', optional: false }))
      );
      const steps = filterBlankSteps(parsed.steps || []);
      const recipe = {
        id: genId(),
        createdAt: Date.now(),
        title: parsed.title || url,
        storeName: '',
        ingredients,
        steps,
        memo: '',
        image: parsed.photoBlob || null,
        icon: 'utensils',
        sourceUrl: url,
        cookingTime: estimateMinutesFromSteps(steps),
        servings: null,
        folderId: null,
      };
      await putRecipe(recipe);
      const complete = ingredients.length > 0 && steps.length > 0;
      results.push({ url, status: complete ? 'success' : 'partial', title: recipe.title });
    } catch (err) {
      results.push({ url, status: 'error', message: err.message });
    }
  }
  return results;
}
