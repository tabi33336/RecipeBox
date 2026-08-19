# 複数端末同期のデプロイ手順（Cloudflare D1 + KV + Workers）

Phase 1の「複数端末での同期」機能を使うには、Cloudflareダッシュボード上で以下の準備が必要です。
[cloudflare-worker/proxy.js](cloudflare-worker/proxy.js)（CORSプロキシ）と同じ手動デプロイの運用ですが、
今回は加えて **D1データベース** と **KVネームスペース** の作成・バインディングが必要です。
コード自体はこちらで書いてあるので、以下の手順通りにダッシュボード上で設定するだけで動きます。

対象アカウント: `tabi33336`（[HANDOFF.md](HANDOFF.md)参照）

---

## 1. D1データベースを作成する

1. [Cloudflareダッシュボード](https://dash.cloudflare.com/) → 左メニュー「Workers & Pages」→「D1 SQL Database」を開く
2. 「Create database」をクリックし、名前を `recipe-sync-db` として作成
3. 作成したデータベースを開き、「Console」タブ（またはクエリ実行画面）に移動
4. [cloudflare-worker/sync-schema.sql](cloudflare-worker/sync-schema.sql) の中身を全文貼り付けて実行する
   - `sync_records` テーブルが作成されればOK

## 2. KVネームスペースを作成する（レシピ写真の保存用）

1. 「Workers & Pages」→「KV」を開く
2. 「Create a namespace」で名前を `recipe-sync-images` として作成

## 3. Workerを作成してコードを貼り付ける

1. 「Workers & Pages」→「Create」→「Create Worker」
2. 名前を `recipe-sync` とする（`recipe-proxy` とは別の、新しいWorkerとして作成）
3. デプロイ後、「Edit code」（Quick Edit）を開く
4. [cloudflare-worker/sync-worker.js](cloudflare-worker/sync-worker.js) の中身を全文コピーして貼り付け、既存のテンプレコードを置き換える
5. まだ「Deploy」は押さず、先に次の手順でバインディングを設定する（コード内で `env.DB` / `env.IMAGES` を参照しているため、バインディングなしでデプロイすると同期リクエスト時にエラーになります）

## 4. D1・KVをWorkerにバインディングする

Worker の管理画面 →「Settings」→「Variables and Bindings」（画面名はダッシュボードの更新で多少変わる場合があります）を開き、以下の2つを追加します。

| Binding type | Variable name | 紐づけ先 |
|---|---|---|
| D1 Database  | `DB`     | 手順1で作成した `recipe-sync-db` |
| KV Namespace | `IMAGES` | 手順2で作成した `recipe-sync-images` |

**変数名（Variable name）は `DB` / `IMAGES` の大文字表記に正確に合わせてください**（sync-worker.js のコードがこの名前で参照しています）。

保存後、Worker を「Deploy」します。

## 5. 発行されたURLをアプリに登録する

1. デプロイ後に発行されるURL（例: `https://recipe-sync.tabi33336.workers.dev`）をコピーする
2. アプリの「設定」画面 →「複数端末での同期」→「同期サーバーURL」欄に貼り付ける
   - `proxy.js` の設定と違い、末尾に `?url=` のようなクエリは不要。URLをそのまま入力する
3. 「同期を開始する」を押すと同期コードが発行され（QRコード表示）、この端末のデータがサーバーへアップロードされる
4. 別の端末でも同じ「同期サーバーURL」を入力し、発行された同期コードを「参加する」欄に入力すれば、データが共有される

---

## 動作確認方法

実装セッション側では、Cloudflareを使わずに同じAPI仕様を持つローカルモックサーバーで push/pull/画像アップロード/ダウンロード/削除の伝播を一通り検証済みです。
実際にCloudflareへデプロイした後は、以下を確認してください。

- 「同期を開始する」でQRコード・同期コードが表示される
- 別の端末（またはブラウザのプライベートウィンドウ）で「参加する」から同じコードを入力すると、レシピ・フォルダ・写真が反映される
- 一方の端末でレシピを編集・削除し、「今すぐ同期」を押すと、もう一方の端末にも反映される

## 既知の制約（Phase 1時点）

- **同期コードが実質的なパスワード代わり**です。厳密なアカウント認証は行っていないため、同期コードは家族など信頼できる相手とだけ共有してください。
- **オフライン中に削除した場合**、削除の伝播（tombstoneのサーバーへの送信）はその場で行われるベストエフォート方式です。削除した端末がオフラインのままだと、オンライン復帰後に自動再送はされません（次にその端末で何かを保存するまで、削除が他端末に伝わらない場合があります）。この点はPhase 2以降で改善candidateです。
- 写真はアップロード前に自動でリサイズ・圧縮されます（長辺1280px・JPEG品質0.8程度）。
- Cloudflare無料枠の範囲内での利用を想定しています（D1: 5GBストレージ、KV: 1GBストレージ、Workers: 1日10万リクエストなど）。個人〜家族利用の規模であれば十分に収まります。
