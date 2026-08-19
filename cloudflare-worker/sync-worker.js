// レシピ帳アプリ用の複数端末同期サーバー
//
// これはアプリの一部として動くコードではなく、Cloudflare Workers の
// ダッシュボードに貼り付けてデプロイするためのコードです（cloudflare-worker/proxy.js と同じ運用）。
// このWorkerは D1データベース（バインディング名: DB）と
// KVネームスペース（バインディング名: IMAGES、レシピ写真の保存用）を必要とします。
// セットアップ手順は SYNC_DEPLOY.md を参照してください。
//
// デプロイすると発行されるURL（例: https://xxxx.yyyy.workers.dev/）を、
// アプリの「設定」画面の「同期サーバーURL」欄に登録してください。
//
// 認証の考え方: 「同期コード」を知っている端末同士が同じデータ空間を共有します。
// パスワード的な厳格な認証は行わないため、同期コードは家族など信頼できる相手とのみ共有してください。

const ALLOWED_METHODS = 'GET, POST, OPTIONS';
const MAX_RECORDS_PER_PUSH = 500;
const MAX_RECORD_JSON_BYTES = 200 * 1024; // 1レコードあたりのJSONサイズ上限
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 圧縮後の画像1枚あたりの上限（base64デコード後）
const SYNC_CODE_RE = /^[A-Za-z0-9]{8,24}$/;
const RECORD_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;
const RECORD_TYPE_RE = /^[a-zA-Z]{1,40}$/;
const IMAGE_KEY_RE = /^[A-Za-z0-9_-]{1,100}$/;

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return new Headers({
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  });
}

function json(request, body, status = 200) {
  const headers = corsHeaders(request);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
}

function badRequest(request, message) {
  return json(request, { ok: false, error: message }, 400);
}

function isValidSyncCode(code) {
  return typeof code === 'string' && SYNC_CODE_RE.test(code);
}

async function handlePush(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest(request, 'invalid JSON body');
  }

  const { syncCode, records } = body || {};
  if (!isValidSyncCode(syncCode)) return badRequest(request, 'invalid syncCode');
  if (!Array.isArray(records)) return badRequest(request, 'records must be an array');
  if (records.length === 0) return json(request, { ok: true, applied: 0 });
  if (records.length > MAX_RECORDS_PER_PUSH) return badRequest(request, 'too many records in one push');

  const stmts = [];
  for (const rec of records) {
    const { type, id, data, updatedAt, deleted } = rec || {};
    if (!RECORD_TYPE_RE.test(type || '')) return badRequest(request, `invalid record type: ${type}`);
    if (!RECORD_ID_RE.test(id || '')) return badRequest(request, `invalid record id: ${id}`);
    if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) {
      return badRequest(request, `invalid updatedAt for record ${id}`);
    }
    const dataJson = JSON.stringify(data ?? null);
    if (dataJson.length > MAX_RECORD_JSON_BYTES) {
      return badRequest(request, `record ${id} exceeds max size`);
    }
    const deletedAt = deleted ? updatedAt : null;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO sync_records (sync_code, record_type, record_id, data, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(sync_code, record_type, record_id) DO UPDATE SET
           data = excluded.data,
           updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at
         WHERE excluded.updated_at >= sync_records.updated_at`
      ).bind(syncCode, type, id, dataJson, updatedAt, deletedAt)
    );
  }

  await env.DB.batch(stmts);
  return json(request, { ok: true, applied: stmts.length });
}

async function handlePull(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest(request, 'invalid JSON body');
  }

  const { syncCode, since } = body || {};
  if (!isValidSyncCode(syncCode)) return badRequest(request, 'invalid syncCode');
  const sinceValue = typeof since === 'number' && Number.isFinite(since) ? since : 0;

  const result = await env.DB.prepare(
    `SELECT record_type, record_id, data, updated_at, deleted_at
     FROM sync_records
     WHERE sync_code = ?1 AND updated_at > ?2`
  ).bind(syncCode, sinceValue).all();

  const records = (result.results || []).map((row) => ({
    type: row.record_type,
    id: row.record_id,
    data: JSON.parse(row.data),
    updatedAt: row.updated_at,
    deleted: row.deleted_at != null,
  }));

  return json(request, { ok: true, records, serverTime: Date.now() });
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function handleImageUpload(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest(request, 'invalid JSON body');
  }

  const { syncCode, key, dataBase64, contentType } = body || {};
  if (!isValidSyncCode(syncCode)) return badRequest(request, 'invalid syncCode');
  if (!IMAGE_KEY_RE.test(key || '')) return badRequest(request, 'invalid image key');
  if (typeof dataBase64 !== 'string' || dataBase64.length === 0) return badRequest(request, 'missing dataBase64');

  let bytes;
  try {
    bytes = base64ToBytes(dataBase64);
  } catch {
    return badRequest(request, 'invalid base64 data');
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) return badRequest(request, 'image too large');

  const kvKey = `img:${syncCode}:${key}`;
  await env.IMAGES.put(kvKey, bytes, {
    metadata: { contentType: contentType || 'image/jpeg' },
  });

  return json(request, { ok: true, key });
}

async function handleImageGet(request, env, syncCode, key) {
  if (!isValidSyncCode(syncCode) || !IMAGE_KEY_RE.test(key)) {
    return new Response('Not found', { status: 404, headers: corsHeaders(request) });
  }
  const kvKey = `img:${syncCode}:${key}`;
  const obj = await env.IMAGES.getWithMetadata(kvKey, 'arrayBuffer');
  if (!obj || obj.value == null) {
    return new Response('Not found', { status: 404, headers: corsHeaders(request) });
  }
  const headers = corsHeaders(request);
  headers.set('Content-Type', obj.metadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'private, max-age=31536000, immutable');
  return new Response(obj.value, { status: 200, headers });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (request.method === 'POST' && path === '/sync/push') return await handlePush(request, env);
      if (request.method === 'POST' && path === '/sync/pull') return await handlePull(request, env);
      if (request.method === 'POST' && path === '/sync/image/upload') return await handleImageUpload(request, env);

      const imageMatch = path.match(/^\/sync\/image\/([^/]+)\/([^/]+)$/);
      if (request.method === 'GET' && imageMatch) {
        return await handleImageGet(request, env, imageMatch[1], imageMatch[2]);
      }

      return new Response('Not found', { status: 404, headers: corsHeaders(request) });
    } catch (err) {
      return json(request, { ok: false, error: `internal error: ${err.message}` }, 500);
    }
  },
};
