import {
  getAllRecipes, getAllFolders, putRecipeRaw, putFolderRaw, deleteRecipe, deleteFolder,
  getAllMealPlanEntries, putMealPlanEntryRaw, deleteMealPlanEntry,
  getAllShoppingLists, putShoppingListRaw, deleteShoppingList,
  getAllUserIngredientAliases, putUserIngredientAliasRaw, deleteUserIngredientAlias,
} from './db.js';
import {
  getSyncCode, setSyncCode, getSyncWorkerUrl, setSyncWorkerUrl, isSyncEnabled,
  getSyncLastPushedAt, setSyncLastPushedAt, getSyncLastPulledAt, setSyncLastPulledAt,
  getSyncImageVersions, setSyncImageVersions, clearSyncSettings,
} from './settings.js';
import { compressImageForSync } from '../features/imageCompress.js';

const SYNC_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい 0/O, 1/I/L を除外
const SYNC_CODE_LENGTH = 12;

export function generateSyncCode() {
  let code = '';
  for (let i = 0; i < SYNC_CODE_LENGTH; i++) {
    code += SYNC_CODE_CHARS[Math.floor(Math.random() * SYNC_CODE_CHARS.length)];
  }
  return code;
}

export { isSyncEnabled, getSyncCode, getSyncWorkerUrl, setSyncWorkerUrl };

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function workerBaseUrl() {
  return getSyncWorkerUrl().replace(/\/$/, '');
}

async function apiFetch(path, body) {
  const res = await fetch(`${workerBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `sync request failed (${res.status})`);
  }
  return res.json();
}

async function fetchImageBlob(syncCode, key) {
  try {
    const res = await fetch(`${workerBaseUrl()}/sync/image/${syncCode}/${key}`);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

function recipeToRecord(recipe) {
  const { id, image, updatedAt, ...rest } = recipe;
  return { type: 'recipe', id, updatedAt, deleted: false, data: { ...rest, imageKey: image ? id : null } };
}

function folderToRecord(folder) {
  const { id, updatedAt, ...rest } = folder;
  return { type: 'folder', id, updatedAt, deleted: false, data: rest };
}

function mealPlanEntryToRecord(entry) {
  const { id, updatedAt, ...rest } = entry;
  return { type: 'mealPlanEntry', id, updatedAt, deleted: false, data: rest };
}

function shoppingListToRecord(list) {
  const { id, updatedAt, ...rest } = list;
  return { type: 'shoppingList', id, updatedAt, deleted: false, data: rest };
}

function userIngredientAliasToRecord(alias) {
  const { id, updatedAt, ...rest } = alias;
  return { type: 'userIngredientAlias', id, updatedAt, deleted: false, data: rest };
}

async function uploadImageIfNeeded(recipe, syncCode) {
  if (!recipe.image) return;
  const versions = getSyncImageVersions();
  if (versions[recipe.id] === recipe.updatedAt) return;
  const compressed = await compressImageForSync(recipe.image);
  const base64 = await blobToBase64(compressed);
  await apiFetch('/sync/image/upload', {
    syncCode,
    key: recipe.id,
    dataBase64: base64,
    contentType: compressed.type || 'image/jpeg',
  });
  versions[recipe.id] = recipe.updatedAt;
  setSyncImageVersions(versions);
}

/** Pushes all locally-changed recipes/folders (updatedAt newer than the last successful push) to the sync server. */
export async function pushChanges() {
  if (!isSyncEnabled()) return { pushed: 0 };
  const syncCode = getSyncCode();
  const lastPushedAt = getSyncLastPushedAt();

  const [recipes, folders, mealPlanEntries, shoppingLists, userAliases] = await Promise.all([
    getAllRecipes(), getAllFolders(), getAllMealPlanEntries(), getAllShoppingLists(), getAllUserIngredientAliases(),
  ]);
  const dirtyRecipes = recipes.filter((r) => r.updatedAt > lastPushedAt);
  const dirtyFolders = folders.filter((f) => f.updatedAt > lastPushedAt);
  const dirtyEntries = mealPlanEntries.filter((e) => e.updatedAt > lastPushedAt);
  const dirtyShoppingLists = shoppingLists.filter((l) => l.updatedAt > lastPushedAt);
  const dirtyAliases = userAliases.filter((a) => a.updatedAt > lastPushedAt);

  for (const recipe of dirtyRecipes) {
    await uploadImageIfNeeded(recipe, syncCode);
  }

  const records = [
    ...dirtyRecipes.map(recipeToRecord),
    ...dirtyFolders.map(folderToRecord),
    ...dirtyEntries.map(mealPlanEntryToRecord),
    ...dirtyShoppingLists.map(shoppingListToRecord),
    ...dirtyAliases.map(userIngredientAliasToRecord),
  ];
  if (records.length === 0) return { pushed: 0 };

  await apiFetch('/sync/push', { syncCode, records });
  setSyncLastPushedAt(Math.max(lastPushedAt, ...records.map((r) => r.updatedAt)));
  return { pushed: records.length };
}

/**
 * Immediately notifies the sync server that a record was deleted locally
 * (local deletion already happened regardless of the outcome here — the
 * caller decides how to surface a failure, e.g. a toast). Deleted records
 * vanish from IndexedDB, so they can't be picked up by the next
 * pushChanges() scan; this is the only way a deletion propagates.
 */
export async function pushDeletion(type, id) {
  if (!isSyncEnabled()) return;
  await apiFetch('/sync/push', {
    syncCode: getSyncCode(),
    records: [{ type, id, updatedAt: Date.now(), deleted: true, data: null }],
  });
}

/** Pulls remote changes since the last successful pull and merges them in (last-write-wins by updatedAt). */
export async function pullChanges() {
  if (!isSyncEnabled()) return { pulled: 0 };
  const syncCode = getSyncCode();
  const since = getSyncLastPulledAt();

  const { records, serverTime } = await apiFetch('/sync/pull', { syncCode, since });

  const [localRecipes, localFolders, localMealPlanEntries, localShoppingLists, localUserAliases] = await Promise.all([
    getAllRecipes(), getAllFolders(), getAllMealPlanEntries(), getAllShoppingLists(), getAllUserIngredientAliases(),
  ]);
  const localRecipeMap = new Map(localRecipes.map((r) => [r.id, r]));
  const localFolderMap = new Map(localFolders.map((f) => [f.id, f]));
  const localMealPlanEntryMap = new Map(localMealPlanEntries.map((e) => [e.id, e]));
  const localShoppingListMap = new Map(localShoppingLists.map((l) => [l.id, l]));
  const localUserAliasMap = new Map(localUserAliases.map((a) => [a.id, a]));

  let applied = 0;
  let pushWatermark = getSyncLastPushedAt();
  const imageVersions = getSyncImageVersions();

  for (const rec of records) {
    if (rec.type === 'recipe') {
      const local = localRecipeMap.get(rec.id);
      if (local && local.updatedAt >= rec.updatedAt) continue;
      if (rec.deleted) {
        if (local) await deleteRecipe(rec.id);
        applied++;
        pushWatermark = Math.max(pushWatermark, rec.updatedAt);
        continue;
      }
      const { imageKey, ...fields } = rec.data;
      const image = imageKey ? await fetchImageBlob(syncCode, imageKey) : null;
      await putRecipeRaw({ id: rec.id, updatedAt: rec.updatedAt, image, ...fields });
      // This exact version came from the server, so there's no need to re-upload
      // its image or re-push the record on our next outgoing sync.
      if (imageKey) imageVersions[rec.id] = rec.updatedAt;
      applied++;
      pushWatermark = Math.max(pushWatermark, rec.updatedAt);
    } else if (rec.type === 'folder') {
      const local = localFolderMap.get(rec.id);
      if (local && local.updatedAt >= rec.updatedAt) continue;
      if (rec.deleted) {
        if (local) await deleteFolder(rec.id);
        applied++;
        pushWatermark = Math.max(pushWatermark, rec.updatedAt);
        continue;
      }
      await putFolderRaw({ id: rec.id, updatedAt: rec.updatedAt, ...rec.data });
      applied++;
      pushWatermark = Math.max(pushWatermark, rec.updatedAt);
    } else if (rec.type === 'mealPlanEntry') {
      const local = localMealPlanEntryMap.get(rec.id);
      if (local && local.updatedAt >= rec.updatedAt) continue;
      if (rec.deleted) {
        if (local) await deleteMealPlanEntry(rec.id);
        applied++;
        pushWatermark = Math.max(pushWatermark, rec.updatedAt);
        continue;
      }
      await putMealPlanEntryRaw({ id: rec.id, updatedAt: rec.updatedAt, ...rec.data });
      applied++;
      pushWatermark = Math.max(pushWatermark, rec.updatedAt);
    } else if (rec.type === 'shoppingList') {
      const local = localShoppingListMap.get(rec.id);
      if (local && local.updatedAt >= rec.updatedAt) continue;
      if (rec.deleted) {
        if (local) await deleteShoppingList(rec.id);
        applied++;
        pushWatermark = Math.max(pushWatermark, rec.updatedAt);
        continue;
      }
      await putShoppingListRaw({ id: rec.id, updatedAt: rec.updatedAt, ...rec.data });
      applied++;
      pushWatermark = Math.max(pushWatermark, rec.updatedAt);
    } else if (rec.type === 'userIngredientAlias') {
      const local = localUserAliasMap.get(rec.id);
      if (local && local.updatedAt >= rec.updatedAt) continue;
      if (rec.deleted) {
        if (local) await deleteUserIngredientAlias(rec.id);
        applied++;
        pushWatermark = Math.max(pushWatermark, rec.updatedAt);
        continue;
      }
      await putUserIngredientAliasRaw({ id: rec.id, updatedAt: rec.updatedAt, ...rec.data });
      applied++;
      pushWatermark = Math.max(pushWatermark, rec.updatedAt);
    }
  }

  setSyncImageVersions(imageVersions);
  setSyncLastPushedAt(pushWatermark);
  setSyncLastPulledAt(serverTime);
  return { pulled: applied };
}

export async function fullSync() {
  if (!isSyncEnabled()) return null;
  const pushResult = await pushChanges();
  const pullResult = await pullChanges();
  return { ...pushResult, ...pullResult };
}

/** Begins syncing under `code` (either freshly generated or entered from another device) and does an initial full sync. */
export async function startSync(code, workerUrl) {
  setSyncCode(code);
  setSyncWorkerUrl(workerUrl);
  setSyncLastPushedAt(0);
  setSyncLastPulledAt(0);
  return fullSync();
}

export function stopSync() {
  clearSyncSettings();
}
