-- レシピ帳アプリ 複数端末同期用のD1スキーマ
--
-- Cloudflareダッシュボード → Workers & Pages → D1 → 対象データベース →「Console」タブに
-- このファイルの内容を貼り付けて実行してください（詳細は SYNC_DEPLOY.md 参照）。

CREATE TABLE IF NOT EXISTS sync_records (
  sync_code   TEXT NOT NULL,
  record_type TEXT NOT NULL,   -- 'recipe' | 'folder' （今後 'mealPlanEntry' 等を追加予定）
  record_id   TEXT NOT NULL,
  data        TEXT NOT NULL,   -- レコード本体のJSON文字列（画像はKVキー参照のみを含む）
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,         -- NULL以外なら論理削除済み（tombstone）
  PRIMARY KEY (sync_code, record_type, record_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_records_lookup
  ON sync_records (sync_code, updated_at);
