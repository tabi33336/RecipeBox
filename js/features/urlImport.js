export const DEFAULT_CORS_PROXY = 'https://api.allorigins.win/raw?url=';

function proxiedUrl(corsProxyUrl, targetUrl) {
  return `${corsProxyUrl}${encodeURIComponent(targetUrl)}`;
}

function extractJSONLDBlocks(html) {
  const blocks = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

function isRecipeType(value) {
  if (typeof value === 'string') return value.toLowerCase() === 'recipe';
  if (Array.isArray(value)) return value.some((v) => typeof v === 'string' && v.toLowerCase() === 'recipe');
  return false;
}

function flattenRecipeCandidates(obj) {
  const results = [];
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    results.push(obj);
    if (Array.isArray(obj['@graph'])) {
      for (const item of obj['@graph']) {
        results.push(...flattenRecipeCandidates(item));
      }
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      results.push(...flattenRecipeCandidates(item));
    }
  }
  return results;
}

function parseInstructions(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) {
    const steps = [];
    for (const item of value) {
      if (typeof item === 'string') {
        steps.push(item);
      } else if (item && typeof item === 'object') {
        if (typeof item.text === 'string') {
          steps.push(item.text);
        } else if (Array.isArray(item.itemListElement)) {
          steps.push(...parseInstructions(item.itemListElement));
        }
      }
    }
    return steps;
  }
  return [];
}

function parseImageUrl(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.url === 'string') {
    return value.url;
  }
  if (Array.isArray(value) && value.length > 0) {
    return parseImageUrl(value[0]);
  }
  return null;
}

function parseRecipe(dict) {
  if (!isRecipeType(dict['@type'])) return null;
  const title = typeof dict.name === 'string' ? dict.name : '';
  const ingredients = Array.isArray(dict.recipeIngredient)
    ? dict.recipeIngredient
    : (Array.isArray(dict.ingredients) ? dict.ingredients : []);
  const steps = parseInstructions(dict.recipeInstructions);
  const imageUrl = parseImageUrl(dict.image);
  if (!title || (ingredients.length === 0 && steps.length === 0)) return null;
  return { title, ingredients, steps, imageUrl };
}

export function parseRecipeFromHtml(html) {
  const blocks = extractJSONLDBlocks(html);
  for (const block of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(block);
    } catch {
      continue;
    }
    const candidates = flattenRecipeCandidates(parsed);
    for (const candidate of candidates) {
      const recipe = parseRecipe(candidate);
      if (recipe) return recipe;
    }
  }
  return null;
}

export async function fetchHtml(url, corsProxyUrl) {
  const res = await fetch(proxiedUrl(corsProxyUrl, url));
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return res.text();
}

export async function fetchImageAsBlob(imageUrl, corsProxyUrl) {
  const res = await fetch(proxiedUrl(corsProxyUrl, imageUrl));
  if (!res.ok) throw new Error(`image fetch failed: ${res.status}`);
  return res.blob();
}

/**
 * Attempts to import a recipe from a URL. Returns the parsed recipe (with an
 * optional `photoBlob`) on success, or null if structured data wasn't found /
 * fetch failed — callers should fall back to saving the URL as a plain link.
 */
export async function importRecipeFromUrl(url, corsProxyUrl) {
  let html;
  try {
    html = await fetchHtml(url, corsProxyUrl);
  } catch {
    return null;
  }
  const recipe = parseRecipeFromHtml(html);
  if (!recipe) return null;

  let photoBlob = null;
  if (recipe.imageUrl) {
    try {
      photoBlob = await fetchImageAsBlob(recipe.imageUrl, corsProxyUrl);
    } catch {
      photoBlob = null;
    }
  }
  return { ...recipe, photoBlob };
}
