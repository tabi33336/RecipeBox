export function autosize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

export function bindAutosize(el) {
  if (!el) return;
  autosize(el);
  el.addEventListener('input', () => autosize(el));
}
