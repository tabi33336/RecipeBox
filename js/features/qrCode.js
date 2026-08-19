import qrcode from '../vendor/qrcode.mjs';

/**
 * Renders `text` as a QR code and returns it as a detached DOM element
 * (an <svg>) that callers can append wherever needed.
 */
export function renderQrCode(text, cellSize = 5, margin = 4) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const svgMarkup = qr.createSvgTag({ cellSize, margin });
  const template = document.createElement('template');
  template.innerHTML = svgMarkup.trim();
  return template.content.firstChild;
}
