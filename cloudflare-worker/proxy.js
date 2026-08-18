// レシピ帳アプリ用の中継サーバー（CORSプロキシ）
//
// これはアプリの一部として動くコードではなく、Cloudflare Workers の
// ダッシュボードに貼り付けてデプロイするためのコードです。
// デプロイすると発行されるURL（例: https://xxxx.yyyy.workers.dev/）の末尾に
// "?url=" を付けたものを、アプリの「設定」画面の「CORSプロキシURL」欄に
// 登録してください。
//
// 例: https://recipe-proxy.yourname.workers.dev/?url=

const ALLOWED_METHODS = 'GET, OPTIONS';

// Echo the request's actual Origin instead of a bare "*" wildcard, and mark
// the response as Origin-dependent via Vary. Some WebKit/Safari versions
// handle the literal "*" wildcard unreliably for cross-origin fetch() reads
// (works fine for a plain top-level page load, which doesn't go through
// CORS at all — only fetch()/XHR does), which is the exact split we saw:
// direct browser visits succeeded while in-app fetch() failed with the
// generic "Load failed" error.
function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return new Headers({
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const requestUrl = new URL(request.url);
    const target = requestUrl.searchParams.get('url');

    if (!target) {
      return new Response('Missing "url" query parameter', {
        status: 400,
        headers: corsHeaders(request),
      });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response('Invalid "url" query parameter', {
        status: 400,
        headers: corsHeaders(request),
      });
    }
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      return new Response('Only http/https URLs are supported', {
        status: 400,
        headers: corsHeaders(request),
      });
    }

    try {
      const upstreamResponse = await fetch(targetUrl.toString(), {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/*,*/*;q=0.8',
          'Accept-Language': 'ja,en;q=0.9',
        },
        redirect: 'follow',
      });

      // Buffer the full body instead of piping upstreamResponse.body through
      // directly, so the response has a known Content-Length rather than
      // chunked transfer encoding.
      const bodyBuffer = await upstreamResponse.arrayBuffer();

      const headers = corsHeaders(request);
      const contentType = upstreamResponse.headers.get('content-type');
      if (contentType) headers.set('Content-Type', contentType);

      return new Response(bodyBuffer, {
        status: upstreamResponse.status,
        headers,
      });
    } catch (err) {
      return new Response(`Proxy fetch failed: ${err.message}`, {
        status: 502,
        headers: corsHeaders(request),
      });
    }
  },
};
