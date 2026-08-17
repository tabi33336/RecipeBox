const DB_NAME = 'recipe-book';
const DB_VERSION = 1;
const STORE_RECIPES = 'recipes';
const STORE_FOLDERS = 'folders';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RECIPES)) {
        db.createObjectStore(STORE_RECIPES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_FOLDERS)) {
        db.createObjectStore(STORE_FOLDERS, { keyPath: 'id' });
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
      await reqToPromise(recipeStore.put(recipe));
    }
  }
}
