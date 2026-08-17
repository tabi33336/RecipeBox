let els = null;
let resolver = null;

function q(id) { return document.getElementById(id); }

function ensureInit() {
  if (els) return;
  els = {
    overlay: q('confirmOverlay'),
    message: q('confirmMessage'),
    cancel: q('confirmCancel'),
    ok: q('confirmOk'),
  };
  els.cancel.addEventListener('click', () => finish(false));
  els.ok.addEventListener('click', () => finish(true));
  els.overlay.addEventListener('click', (e) => {
    if (e.target === els.overlay) finish(false);
  });
}

function finish(result) {
  els.overlay.classList.remove('open');
  if (resolver) {
    resolver(result);
    resolver = null;
  }
}

export function confirmDialog(message, okLabel) {
  ensureInit();
  els.message.textContent = message;
  els.ok.textContent = okLabel || '削除';
  els.overlay.classList.add('open');
  return new Promise((resolve) => { resolver = resolve; });
}
