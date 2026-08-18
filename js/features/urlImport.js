export const DEFAULT_CORS_PROXY = 'https://recipe-proxy.tabi33336.workers.dev/?url=';

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

function decodeHtmlEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractMetaTags(html) {
  const metas = {};
  const re = /<meta\b[^>]*>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const tag = match[0];
    const propMatch = tag.match(/\bproperty=["']([^"']+)["']/i) || tag.match(/\bname=["']([^"']+)["']/i);
    const contentMatch = tag.match(/\bcontent=["']([^"']*)["']/i);
    if (propMatch && contentMatch) {
      metas[propMatch[1].toLowerCase()] = decodeHtmlEntities(contentMatch[1]);
    }
  }
  return metas;
}

/**
 * Best-effort fallback for pages without schema.org Recipe data (e.g.
 * Instagram posts): reads Open Graph tags for a photo and the raw caption
 * text. There's no structured ingredients/steps here, so callers should
 * surface the caption as reference text for the user to copy from manually.
 */
export function parseOgTagsFromHtml(html) {
  const metas = extractMetaTags(html);
  const title = metas['og:title'] || '';
  const description = metas['og:description'] || '';
  const imageUrl = metas['og:image'] || null;
  if (!description && !imageUrl) return null;
  return { title, description, imageUrl };
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

async function tryFetchPhoto(imageUrl, corsProxyUrl) {
  if (!imageUrl) return null;
  try {
    return await fetchImageAsBlob(imageUrl, corsProxyUrl);
  } catch {
    return null;
  }
}

/**
 * Attempts to import a recipe from a URL.
 *
 * Returns one of:
 * - { kind: 'structured', title, ingredients, steps, photoBlob } when a
 *   schema.org Recipe was found (cookpad, kurashiru, etc.)
 * - { kind: 'caption', title, caption, photoBlob } when no structured recipe
 *   data exists but Open Graph tags did (e.g. Instagram posts) — the caption
 *   is unstructured free text for the user to copy ingredients/steps from
 * - null if the page was reachable but had no usable recipe data — callers
 *   should fall back to saving the URL as a plain link
 *
 * Throws if the fetch itself fails (network error, proxy down, etc.) —
 * callers should distinguish this from the null case so the real failure
 * reason is visible instead of being reported as "no data found".
 */
export async function importRecipeFromUrl(url, corsProxyUrl) {
  const html = await fetchHtml(url, corsProxyUrl);

  const recipe = parseRecipeFromHtml(html);
  if (recipe) {
    const photoBlob = await tryFetchPhoto(recipe.imageUrl, corsProxyUrl);
    return { kind: 'structured', ...recipe, photoBlob };
  }

  const og = parseOgTagsFromHtml(html);
  if (og) {
    const photoBlob = await tryFetchPhoto(og.imageUrl, corsProxyUrl);
    return { kind: 'caption', title: og.title, caption: og.description, photoBlob };
  }

  return null;
}
