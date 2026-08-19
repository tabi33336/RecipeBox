const DB_NAME = 'recipe-book';
const DB_VERSION = 4;
const STORE_RECIPES = 'recipes';
const STORE_FOLDERS = 'folders';
const STORE_MEAL_PLAN = 'mealPlanEntries';
const STORE_SHOPPING_LISTS = 'shoppingLists';
const STORE_USER_ALIASES = 'userIngredientAliases';

let dbPromise = null;

/**
 * Phase 1 schema migration (v1 -> v2): cookingMinutes -> cookingTime,
 * sourceURL -> sourceUrl, photo -> image; adds updatedAt/servings; and
 * numeric-parses ingredient amounts where possible ("2" -> 2, "少々" stays
 * as-is). Runs once per record inside the version-change transaction.
 */
function migrateRecipeToV2(recipe) {
  const { cookingMinutes, sourceURL, photo, ...rest } = recipe;
  const migrated = { ...rest };
  if ('cookingMinutes' in recipe) migrated.cookingTime = cookingMinutes;
  if ('sourceURL' in recipe) migrated.sourceUrl = sourceURL;
  if ('photo' in recipe) migrated.image = photo;
  if (migrated.servings === undefined) migrated.servings = null;
  if (migrated.updatedAt == null) migrated.updatedAt = migrated.createdAt ?? Date.now();
  if (Array.isArray(migrated.ingredients)) {
    migrated.ingredients = migrated.ingredients.map((ing) => ({
      ...ing,
      amount: parseAmountForMigration(ing.amount),
      optional: ing.optional ?? false,
    }));
  }
  return migrated;
}

function parseAmountForMigration(raw) {
  if (raw == null || typeof raw === 'number') return raw ?? '';
  const trimmed = String(raw).trim();
  if (trimmed === '') return '';
  const fraction = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const denom = parseInt(fraction[2], 10);
    if (denom !== 0) return parseInt(fraction[1], 10) / denom;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
  return trimmed;
}

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RECIPES)) {
        db.createObjectStore(STORE_RECIPES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_FOLDERS)) {
        db.createObjectStore(STORE_FOLDERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_MEAL_PLAN)) {
        db.createObjectStore(STORE_MEAL_PLAN, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SHOPPING_LISTS)) {
        db.createObjectStore(STORE_SHOPPING_LISTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_USER_ALIASES)) {
        db.createObjectStore(STORE_USER_ALIASES, { keyPath: 'id' });
      }
      if (event.oldVersion < 2 && db.objectStoreNames.contains(STORE_RECIPES)) {
        const store = req.transaction.objectStore(STORE_RECIPES);
        store.openCursor().onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) return;
          cursor.update(migrateRecipeToV2(cursor.value));
          cursor.continue();
        };
      }
      if (event.oldVersion < 2 && db.objectStoreNames.contains(STORE_FOLDERS)) {
        const store = req.transaction.objectStore(STORE_FOLDERS);
        store.openCursor().onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) return;
          const folder = cursor.value;
          if (folder.updatedAt == null) {
            cursor.update({ ...folder, updatedAt: folder.createdAt ?? Date.now() });
          }
          cursor.continue();
        };
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function genId() {
  return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

export async function getAllRecipes() {
  const store = await tx(STORE_RECIPES, 'readonly');
  return reqToPromise(store.getAll());
}

export async function getRecipe(id) {
  const store = await tx(STORE_RECIPES, 'readonly');
  return reqToPromise(store.get(id));
}

export async function putRecipe(recipe) {
  const stamped = { ...recipe, updatedAt: Date.now() };
  const store = await tx(STORE_RECIPES, 'readwrite');
  await reqToPromise(store.put(stamped));
  return stamped;
}

/**
 * Stores a recipe exactly as given, without stamping updatedAt. Used when
 * merging records pulled from the sync server, where updatedAt must be
 * preserved as the authoritative modification time from the source device.
 */
export async function putRecipeRaw(recipe) {
  const store = await tx(STORE_RECIPES, 'readwrite');
  await reqToPromise(store.put(recipe));
  return recipe;
}

export async function deleteRecipe(id) {
  const store = await tx(STORE_RECIPES, 'readwrite');
  return reqToPromise(store.delete(id));
}

export async function getAllFolders() {
  const store = await tx(STORE_FOLDERS, 'readonly');
  return reqToPromise(store.getAll());
}

export async function putFolder(folder) {
  const stamped = { ...folder, updatedAt: Date.now() };
  const store = await tx(STORE_FOLDERS, 'readwrite');
  await reqToPromise(store.put(stamped));
  return stamped;
}

/** See putRecipeRaw — same rationale, for folders pulled from the sync server. */
export async function putFolderRaw(folder) {
  const store = await tx(STORE_FOLDERS, 'readwrite');
  await reqToPromise(store.put(folder));
  return folder;
}

export async function deleteFolder(id) {
  const folderStore = await tx(STORE_FOLDERS, 'readwrite');
  await reqToPromise(folderStore.delete(id));
  const recipeStore = await tx(STORE_RECIPES, 'readwrite');
  const recipes = await reqToPromise(recipeStore.getAll());
  for (const recipe of recipes) {
    if (recipe.folderId === id) {
      recipe.folderId = null;
      recipe.updatedAt = Date.now();
      await reqToPromise(recipeStore.put(recipe));
    }
  }
}

export async function getAllMealPlanEntries() {
  const store = await tx(STORE_MEAL_PLAN, 'readonly');
  return reqToPromise(store.getAll());
}

export async function putMealPlanEntry(entry) {
  const stamped = { ...entry, updatedAt: Date.now() };
  const store = await tx(STORE_MEAL_PLAN, 'readwrite');
  await reqToPromise(store.put(stamped));
  return stamped;
}

/** See putRecipeRaw — same rationale, for meal plan entries pulled from the sync server. */
export async function putMealPlanEntryRaw(entry) {
  const store = await tx(STORE_MEAL_PLAN, 'readwrite');
  await reqToPromise(store.put(entry));
  return entry;
}

export async function deleteMealPlanEntry(id) {
  const store = await tx(STORE_MEAL_PLAN, 'readwrite');
  return reqToPromise(store.delete(id));
}

/** Deletes every meal plan entry referencing `recipeId` (used when a recipe itself is deleted). Returns the deleted entries so callers can propagate tombstones. */
export async function deleteMealPlanEntriesForRecipe(recipeId) {
  const store = await tx(STORE_MEAL_PLAN, 'readwrite');
  const all = await reqToPromise(store.getAll());
  const toDelete = all.filter((e) => e.recipeId === recipeId);
  for (const entry of toDelete) {
    await reqToPromise(store.delete(entry.id));
  }
  return toDelete;
}

export async function getAllShoppingLists() {
  const store = await tx(STORE_SHOPPING_LISTS, 'readonly');
  return reqToPromise(store.getAll());
}

export async function putShoppingList(list) {
  const stamped = { ...list, updatedAt: Date.now() };
  const store = await tx(STORE_SHOPPING_LISTS, 'readwrite');
  await reqToPromise(store.put(stamped));
  return stamped;
}

/** See putRecipeRaw — same rationale, for shopping lists pulled from the sync server. */
export async function putShoppingListRaw(list) {
  const store = await tx(STORE_SHOPPING_LISTS, 'readwrite');
  await reqToPromise(store.put(list));
  return list;
}

export async function deleteShoppingList(id) {
  const store = await tx(STORE_SHOPPING_LISTS, 'readwrite');
  return reqToPromise(store.delete(id));
}

export async function getAllUserIngredientAliases() {
  const store = await tx(STORE_USER_ALIASES, 'readonly');
  return reqToPromise(store.getAll());
}

export async function putUserIngredientAlias(alias) {
  const stamped = { ...alias, updatedAt: Date.now() };
  const store = await tx(STORE_USER_ALIASES, 'readwrite');
  await reqToPromise(store.put(stamped));
  return stamped;
}

/** See putRecipeRaw — same rationale, for user-defined aliases pulled from the sync server. */
export async function putUserIngredientAliasRaw(alias) {
  const store = await tx(STORE_USER_ALIASES, 'readwrite');
  await reqToPromise(store.put(alias));
  return alias;
}

export async function deleteUserIngredientAlias(id) {
  const store = await tx(STORE_USER_ALIASES, 'readwrite');
  return reqToPromise(store.delete(id));
}
