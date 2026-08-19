const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.8;

/**
 * Resizes `blob` so its longer edge is at most MAX_DIMENSION and re-encodes
 * it as JPEG, to keep synced photos small (sync server + KV storage/transfer
 * budget, mobile data usage). Returns the original blob unchanged if it's
 * already small enough or if decoding fails (e.g. unsupported format).
 */
export async function compressImageForSync(blob) {
  if (!blob) return blob;
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return blob;
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const compressed = await new Promise((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/jpeg', JPEG_QUALITY);
  });

  if (!compressed) return blob;
  return compressed.size < blob.size ? compressed : blob;
}
