# レシピ帳Webアプリ 引き継ぎ資料（Phase 0完了時点／Phase 1進行中）

このドキュメントは、レシピ帳WebアプリのPhase 0（MVP構築）が完了した時点の状態をまとめた引き継ぎ資料です。
新しいセッションはこの内容を前提として、Phase 1以降の開発を進めてください。

**Phase 1の進捗・詳細は [PHASE1_REQUIREMENTS.md](PHASE1_REQUIREMENTS.md) を参照してください。** 以下は主にPhase 0時点の記述ですが、
「複数端末での同期」機能の追加に伴い、データ保存とファイル構成の一部が更新されています（該当箇所に追記あり）。

## 現在の状態（すべて実機で動作確認済み）

- **公開URL**: https://tabi33336.github.io/RecipeBox/
- **GitHubリポジトリ**: https://github.com/tabi33336/RecipeBox （public、GitHub Pagesで公開中）
- **ローカルソース**: `C:\Users\skier\クロード\RecipeWebApp\`
- **ローカルgit**: 初期化済み・全コミット済み（`git log` 参照）。ただし `git push` は後述の理由で使わない運用
- GitHubアカウント: `tabi33336`
- Cloudflareアカウント: Workers & Pages に `recipe-proxy` という名前のWorkerをデプロイ済み

## アーキテクチャ概要

- **フレームワークなし**の素のHTML/CSS/JS（ES modules、ビルド工程なし）
- **データ保存**: ブラウザの IndexedDB（レシピ・フォルダ本体、写真もBlobで保存）+ localStorage（設定: Gemini APIキー・モデル名・CORSプロキシURL・同期設定）。**バックエンド・DBサーバーは無し**が基本方針。ただし**Phase 1で「複数端末での同期」をオプション機能として追加**（後述）。同期を有効化しない限り、端末ごとにデータは独立
- **ホスティング**: GitHub Pages（静的ファイルをそのまま配信）
- **URL取り込み用の中継サーバー**: Cloudflare Workers（無料枠）に自前でデプロイした CORS プロキシ。ソースは [cloudflare-worker/proxy.js](cloudflare-worker/proxy.js)
- **AI機能**: ユーザー自身のGemini APIキー（無料枠）を設定画面で保存し、ブラウザから直接Google Gemini APIへ送信。中継サーバーは経由しない

## デプロイ方法（★重要・通常のgit pushではない）

このユーザーの環境では `git push` がGitHub認証のポップアップ待ちで固まって機能しないことが判明したため、以下の手動フローを採用している。

**アプリ本体（GitHub Pages）を更新する場合:**
1. ローカルで通常通り `git add -A && git commit`（コミットのみ、pushはしない）
2. ユーザー自身が https://github.com/tabi33336/RecipeBox を開き、**「Add file」→「Upload files」** で `RecipeWebApp` フォルダの中身を丸ごとドラッグ＆ドロップして **「Commit changes」**
3. GitHub Pagesが自動で再デプロイ（数十秒〜数分）

**Cloudflare Worker（中継サーバー）を更新する場合:**
GitHubへのアップロードとは別物。[https://dash.cloudflare.com/](https://dash.cloudflare.com/) → Workers & Pages → `recipe-proxy` → 「Edit code」で貼り替えて「Deploy」する必要がある。`cloudflare-worker/proxy.js` は参照用に同期させているが、実際に動いているのはCloudflare側にデプロイされたコードなので、**このファイルを更新したら必ずCloudflare側にも手動で反映する**こと。

## Phase 0で実装済みの機能（すべて実機確認済み）

1. レシピ一覧・詳細・追加編集の3画面 + 設定画面
2. フォルダ機能（作成・改名・削除、削除時は所属レシピが未分類に戻る）
3. 検索・並び替え（追加日/名前/店舗名/調理時間、調理時間未設定は末尾）
4. 材料名→単位の自動補完（上書きガード付き）
5. 作り方からの調理時間自動算出（上書きガード付き、注記UI付き）
6. レシピURL取り込み（schema.org Recipe / JSON-LDを解析。cookpad, kurashiruなどで確認済み）。JSON-LDが無い場合はOGタグ（写真＋キャプション文）にフォールバック、それも無ければURLのみリンク保存
7. 共有機能（テキスト生成 + Web Share API / クリップボードコピー）
8. AI機能（写真からレシピ推測、Gemini API使用）
9. 入力欄の自動縦拡張
10. レスポンシブ対応（PC/タブレット/スマホ）、ライトテーマ固定

## 既知の制約・ハマったポイント（次のセッションで同じ沼にハマらないために）

- **Instagram投稿URLの自動取り込みは不可能**。Instagramは非ブラウザからのアクセスにログイン画面を返すため、中継サーバー経由でもJSON-LDはおろかOGタグすら取得できない（実機検証済み）。URLのみリンク保存にフォールバックする作りになっているので壊れはしないが、材料・手順の自動反映は原理的に無理。
- 当初は無料の公開CORSプロキシ（allorigins.win等）を使っていたが**信頼性が低く実運用で頻繁に失敗**したため、自前のCloudflare Workerに切り替え済み。
- **重要な罠（実際にハマった）**: 設定画面の「保存」ボタンは、Gemini関連の項目だけでなく**CORSプロキシURL欄に"今表示されている値"も一緒に保存してしまう**仕様。localStorageは端末ごとに独立しているため、ある端末で（CORSプロキシとは無関係な用事で）設定画面を開いて保存すると、意図せず古い/別の値でCORSプロキシURLが上書きされることがある。実際にこれが原因でiPhoneでのURL取り込みだけが失敗する不具合が起きた（原因究明にかなり時間がかかった）。もし将来「一部の端末だけで機能しない」系の不具合が出たら、まずこの設定値のズレを疑うこと。
- Safari/WebKit（iPhone）は、CORSプロキシのレスポンスで `Access-Control-Allow-Origin: *`（ワイルドカード）よりも、リクエスト元Originを動的にエコーバックする方式の方が相性が良い場合がある（`cloudflare-worker/proxy.js` は既にこの対応済み）。
- Cloudflare Workerのレスポンスは、ストリーミング（`upstream.body` をそのまま渡す）ではなく `arrayBuffer()` で一度読み切ってから返す方が安定する（Content-Lengthが明確になるため）。
- Gemini APIのモデル名は数ヶ月単位で廃止される（`gemini-2.0-flash` は既に廃止済みだった）。`gemini-flash-latest` のような "-latest" エイリアスを使うことで、モデル廃止のたびにコードや設定を直す必要がなくなる。既にこの対応済み。
- 開発中、ローカルの `python -m http.server` は静的ファイルを積極的にキャッシュしてしまい、コード変更が反映されないことがあった → `dev-server.py`（`Cache-Control: no-store` を付与するラッパースクリプト）を使うこと。`.claude/launch.json`（プロジェクトルートの親、`C:\Users\skier\クロード\.claude\launch.json`）がこれを起動する設定になっている。
- CSSで `[hidden]` 属性を使う場合、`.btn { display: flex }` のような通常のクラスセレクタがUAスタイルシートの `[hidden]{display:none}` を上書きしてしまうことがある → `[hidden] { display: none !important; }` を明示的に定義済み（[css/tokens.css](css/tokens.css)）。
- モーダル/オーバーレイのz-indexは重なり順に注意（削除確認ダイアログがフォルダ管理モーダルの裏に隠れるバグが実際にあった）。
- ダークモードは視認性が悪いという要望により**意図的に無効化**（常にライトテーマで固定）。復活させる場合はその点をユーザーに確認すること。
- 自動テストツール（Claude Codeのブラウザプレビュー機能）のモバイルエミュレーションでは、クリック操作がタイムアウトすることがあった（JS経由で `.click()` を呼ぶ、または実機での確認に切り替えると安定する）。

## ファイル構成

```
RecipeWebApp/
├─ HANDOFF.md              # このファイル
├─ PHASE1_REQUIREMENTS.md  # Phase 1（同期・献立カレンダー・買い物リスト等）の要件定義
├─ SYNC_DEPLOY.md          # 同期機能のCloudflareデプロイ手順（D1/KV/Worker）
├─ INGREDIENT_ALIAS_PROMPT.md  # 食材名同義語辞書を別セッションで作る際の着手用プロンプト
├─ index.html
├─ dev-server.py           # 開発用ローカルサーバー（キャッシュ無効化。PORT環境変数で待受ポート変更可）
├─ cloudflare-worker/
│  ├─ proxy.js             # CORSプロキシ Workerのソース（参照用。実体は手動デプロイが必要）
│  ├─ sync-worker.js       # 同期用 Workerのソース（参照用。D1+KVバインディングが必要。SYNC_DEPLOY.md参照）
│  └─ sync-schema.sql      # 同期用D1データベースのスキーマ
├─ css/
│  ├─ tokens.css           # カラートークン・タイポグラフィ（ライトテーマ固定）
│  ├─ layout.css
│  └─ components.css
└─ js/
   ├─ main.js               # 初期化・ビュー切替
   ├─ icons.js               # SVGアイコン
   ├─ data/                  # db.js(IndexedDB) / recipeUtils.js / settings.js(localStorage) / sync.js(複数端末同期) / mealPlanUtils.js(献立カレンダー) / ingredientAliases.js(組み込み表記ゆれ辞書) / ingredientNormalize.js(正規化)
   ├─ features/              # unitSuggest / cookingTime / urlImport / share / aiGuess / imageCompress / qrCode / shoppingListAggregate
   ├─ ui/                    # list / detail / edit / folders / settings / calendar / shoppingList
   ├─ utils/                 # autoExpand / toast / confirmDialog
   └─ vendor/                # qrcode.mjs（QRコード生成、kazuhikoarase/qrcode-generator, MITライセンス、手動vendor）
```

## 参考: これまでの成果物の場所

- 当初の要件定義（iOS→Web方針転換の引き継ぎ資料）: `C:\Users\skier\クロード\RecipeWebApp-Handoff\REQUIREMENTS.md`
- Swiftプロジェクト（ロジック参照用、今後は直接使わない）: `C:\Users\skier\クロード\RecipeApp\`

## Phase 1の進捗

詳細要件は [PHASE1_REQUIREMENTS.md](PHASE1_REQUIREMENTS.md) 参照。実装順序は ③データ拡張 → ①同期基盤 → ②献立カレンダー → ④買い物リスト。

- **③レシピデータ拡張: 完了。** `servings`（人数）追加、`difficulty`は不要と判断し実装せず、材料に`optional`（任意フラグ）・分量プリセット（少々/適量等）を追加。IndexedDBは`DB_VERSION=2`へ自動マイグレーション済み（`cookingMinutes`→`cookingTime`、`sourceURL`→`sourceUrl`、`photo`→`image`、`updatedAt`付与、`amount`の可能な範囲での数値化）。実機でマイグレーション・保存・表示を検証済み。
- **①複数端末での同期: 完了。Cloudflareへの実デプロイ・本番動作確認まで完了済み。**
  - Cloudflare D1（レコード保存）+ Workers KV（写真保存）+ 新規Worker（`recipe-sync`）という構成。同期コード方式（アカウント登録不要、コードを知る端末同士が同じデータ空間を共有）。`updatedAt`によるLast-Write-Winsで自動マージ（初回接続時も上書きではなく安全にマージされる設計）。
  - 削除は即時tombstone送信のベストエフォート方式（オフライン中の削除は次回保存まで伝播しない既知の制約あり）。写真は同期前に自動圧縮。
  - QRコードでの同期コード共有に対応（`kazuhikoarase/qrcode-generator`をvendor）。
  - Cloudflareダッシュボードでの実際のセットアップ（D1/KV/Worker作成、バインディング、スキーマ実行）はユーザーが実施済み。本番環境で push/pull/画像アップロード・ダウンロード/削除伝播/日本語文字列の往復まで実機（ブラウザのfetch経由）で確認済み。
  - **ハマりどころ**: Cloudflareダッシュボードで新規Worker（`recipe-sync`）を作る際、既存の`recipe-proxy`と間違えてバインディングを追加してしまいやすい（左メニューの「Recents」に両方並ぶため）。バインディング設定前に、対象Workerの名前をURL/パンくずで必ず確認すること。
- **②献立カレンダー: 完了。**
  - `MealPlanEntry`（`date`/`mealType`/`recipeId`/`memo`/`updatedAt`等）を新規ストアとして追加（`DB_VERSION=3`）。食事区分は朝食/昼食/夕食の3種固定。
  - 下部タブバー（レシピ一覧／カレンダー／買い物／設定）を新設し、月表示カレンダー・日別詳細オーバーレイ・レシピ選択オーバーレイを実装。
  - レシピ削除時、献立カレンダーで使用中なら警告した上でカスケード削除（tombstoneも連動送信）。
  - `js/data/sync.js`を`mealPlanEntry`にも対応拡張済み（push/pull両対応）。
  - 実機ブラウザで、レシピ追加・月送り・カスケード削除・タブ切り替えまで動作確認済み。
- **④買い物リスト: 完了。**
  - `ShoppingList`（`startDate`/`endDate`/`items[]`/`updatedAt`等）・`UserIngredientAlias`（ユーザー定義の表記ゆれ辞書）を新規ストアとして追加（`DB_VERSION=4`）。
  - `js/data/ingredientNormalize.js`が組み込み辞書（`js/data/ingredientAliases.js`、201件）とユーザー定義辞書をマージして正規化。`js/features/shoppingListAggregate.js`が期間内の献立から材料を展開し、正規化後グルーピング→数値amountは合算、非数値（「少々」等）は個別列挙（ただし完全一致の重複は`×N`表示にまとめる。単位が異なる場合は合算せず別行）。
  - 買い物リスト画面: 期間指定（日付入力＋今週/来週プリセット）→作成、チェックリスト（チェック・削除）、手動追加、生成履歴からの再表示に対応。
  - 設定画面にユーザー定義エイリアス辞書の追加・削除UIを実装（組み込み辞書でカバーできない表記ゆれを追加できる）。
  - `js/data/sync.js`を`shoppingList`・`userIngredientAlias`にも対応拡張済み（push/pull両対応）。
  - 実機ブラウザで、表記ゆれ正規化（組み込み辞書・ユーザー定義辞書の両方）、数値合算、非数値の重複統合、チェック・手動追加・削除・履歴表示まで動作確認済み。

**Phase 1で計画していた4機能（①〜④）はすべて実装完了。** 残る作業はgit commit + GitHubへの手動アップロード（デプロイ）と、実機での最終確認。

**要件との突き合わせで見つけて追加修正した2点:**
- オンライン復帰時の自動同期（要件1.2/2.3で明記されていたが未実装だった）: `main.js`に`window.addEventListener('online', ...)`を追加し、オフライン→オンライン復帰時に自動で`fullSync()`を実行するようにした。
- 同期失敗時のフィードバック（要件2.2）: `pushDeletion`が内部でエラーを握りつぶしていて呼び出し元に一切伝わらない実装になっていたため修正。`js/utils/syncFeedback.js`の`reportSyncError`を全ての同期呼び出し箇所（保存・削除・フォルダ・カレンダー・買い物リスト・エイリアス辞書）に配線し、バックグラウンド同期が失敗した際にトーストで軽く通知するようにした。

## Phase 1以降で検討候補（未着手・優先度はユーザーと要相談）

- ホスティング/中継サーバーの信頼性向上（カスタムドメイン化、監視など）
- PWA化（オフライン対応・ホーム画面への追加）
- Instagram以外のSNS投稿取り込みの可否検討
