import { getAllRecipes, putFolder, deleteFolder, genId } from '../data/db.js';
import { pushDeletion } from '../data/sync.js';
import { confirmDialog } from '../utils/confirmDialog.js';
import { reportSyncError } from '../utils/syncFeedback.js';
import { UI_ICONS } from '../icons.js';

const els = {};
let onChange = () => {};
let folders = [];

function q(id) { return document.getElementById(id); }

export function initFolders(changeCallback) {
  onChange = changeCallback;
  els.overlay = q('folderManageOverlay');
  els.list = q('folderManageList');
  els.btnClose = q('btnCloseFolderManage');
  els.newName = q('newFolderNameInput');
  els.btnAdd = q('btnAddFolder');

  els.btnClose.innerHTML = UI_ICONS.close;
  els.btnClose.addEventListener('click', close);
  els.overlay.addEventListener('click', (e) => { if (e.target === els.overlay) close(); });

  els.btnAdd.addEventListener('click', addFolder);
  els.newName.addEventListener('keydown', (e) => { if (e.key === 'Enter') addFolder(); });
}

async function addFolder() {
  const name = els.newName.value.trim();
  if (!name) return;
  const folder = { id: genId(), name, createdAt: Date.now() };
  await putFolder(folder);
  folders = [...folders, folder];
  els.newName.value = '';
  render();
  await onChange();
}

async function renameFolder(folder, newName) {
  if (!newName.trim() || newName.trim() === folder.name) return;
  folder.name = newName.trim();
  await putFolder(folder);
  await onChange();
}

async function removeFolder(folder) {
  const recipes = await getAllRecipes();
  const count = recipes.filter((r) => r.folderId === folder.id).length;
  const message = count > 0
    ? `「${folder.name}」を削除しますか？所属する${count}件のレシピは「未分類」に戻ります。`
    : `「${folder.name}」を削除しますか？`;
  const ok = await confirmDialog(message, '削除する');
  if (!ok) return;
  await deleteFolder(folder.id);
  folders = folders.filter((f) => f.id !== folder.id);
  render();
  await onChange();
  pushDeletion('folder', folder.id).catch(reportSyncError);
}

function render() {
  els.list.innerHTML = '';
  if (folders.length === 0) {
    const p = document.createElement('p');
    p.className = 'card-meta';
    p.textContent = 'フォルダがありません。';
    els.list.appendChild(p);
    return;
  }
  for (const folder of folders) {
    const row = document.createElement('div');
    row.className = 'ingredient-row';

    const field = document.createElement('div');
    field.className = 'field name-field';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = folder.name;
    input.addEventListener('change', () => renameFolder(folder, input.value));
    field.appendChild(input);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-icon row-remove';
    removeBtn.innerHTML = UI_ICONS.trash;
    removeBtn.addEventListener('click', () => removeFolder(folder));

    row.append(field, removeBtn);
    els.list.appendChild(row);
  }
}

export function openFolderManage(foldersList) {
  folders = foldersList;
  render();
  els.overlay.classList.add('open');
}

function close() {
  els.overlay.classList.remove('open');
}
