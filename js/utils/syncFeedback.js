import { showToast } from './toast.js';

/** Lightweight, non-blocking feedback for background sync failures (auto-push on save/delete, reconnect sync, etc.). */
export function reportSyncError(err) {
  console.warn('sync: operation failed', err);
  showToast('同期に失敗しました（後で「今すぐ同期」をお試しください）');
}
