import { UI_ICONS } from '../icons.js';

let els = null;
let currentlySuccess = false;

function q(id) { return document.getElementById(id); }

function ensureInit() {
  if (els) return;
  els = {
    overlay: q('importResultOverlay'),
    icon: q('importResultIcon'),
    title: q('importResultTitle'),
    message: q('importResultMessage'),
    btnClose: q('btnCloseImportResult'),
  };
  els.btnClose.addEventListener('click', close);
  els.overlay.addEventListener('click', (e) => {
    // Success is a celebratory confirmation, so any tap inside the dialog
    // dismisses it. Other outcomes carry a message worth reading, so only
    // tapping the backdrop (not the box itself) or the button dismisses them.
    if (currentlySuccess || e.target === els.overlay) close();
  });
}

function close() {
  els.overlay.classList.remove('open');
}

/**
 * Shows a dialog reporting the outcome of a recipe URL import.
 * `success: true` renders a checkmark and can be dismissed by tapping
 * anywhere on the dialog; otherwise it's an informational message that
 * requires tapping the backdrop or the close button.
 */
export function showImportResult({ success, title, message }) {
  ensureInit();
  currentlySuccess = !!success;
  els.icon.hidden = !success;
  if (success) els.icon.innerHTML = UI_ICONS.check;
  els.title.textContent = title;
  els.message.textContent = message;
  els.overlay.classList.add('open');
}
