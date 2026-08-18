# レシピ帳Webアプリ 引き継ぎ資料（Phase 0完了時点）

このドキュメントは、レシピ帳WebアプリのPhase 0（MVP構築）が完了した時点の状態をまとめた引き継ぎ資料です。
新しいセッションはこの内容を前提として、Phase 1以降の開発を進めてください。

## 現在の状態（すべて実機で動作確認済み）

- **公開URL**: https://tabi33336.github.io/RecipeBox/
- **GitHubリポジトリ**: https://github.com/tabi33336/RecipeBox （public、GitHub Pagesで公開中）
- **ローカルソース**: `C:\Users\skier\クロード\RecipeWebApp\`
- **ローカルgit**: 初期化済み・全コミット済み（`git log` 参照）。ただし `git push` は後述の理由で使わない運用
- GitHubアカウント: `tabi33336`
- Cloudflareアカウント: Workers & Pages に `recipe-proxy` という名前のWorkerをデプロイ済み

## アーキテクチャ概要

- **フレームワークなし**の素のHTML/CSS/JS（ES modules、ビルド工程なし）
- **データ保存**: ブラウザの IndexedDB（レシピ・フォルダ本体、写真もBlobで保存）+ localStorage（設定: Gemini APIキー・モデル名・CORSプロキシURL）。**バックエンド・DBサーバーは無し**。端末ごとにデータは独立（同期なし）
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
├─ index.html
├─ dev-server.py           # 開発用ローカルサーバー（キャッシュ無効化）
├─ cloudflare-worker/
│  └─ proxy.js             # Cloudflare Workerのソース（参照用。実体は手動デプロイが必要）
├─ css/
│  ├─ tokens.css           # カラートークン・タイポグラフィ（ライトテーマ固定）
│  ├─ layout.css
│  └─ components.css
└─ js/
   ├─ main.js               # 初期化・ビュー切替
   ├─ icons.js               # SVGアイコン
   ├─ data/                  # db.js(IndexedDB) / recipeUtils.js / settings.js(localStorage)
   ├─ features/              # unitSuggest / cookingTime / urlImport / share / aiGuess
   ├─ ui/                    # list / detail / edit / folders / settings
   └─ utils/                 # autoExpand / toast / confirmDialog
```

## 参考: これまでの成果物の場所

- 当初の要件定義（iOS→Web方針転換の引き継ぎ資料）: `C:\Users\skier\クロード\RecipeWebApp-Handoff\REQUIREMENTS.md`
- Swiftプロジェクト（ロジック参照用、今後は直接使わない）: `C:\Users\skier\クロード\RecipeApp\`

## Phase 1で検討候補（未着手・優先度はユーザーと要相談）

- ホスティング/中継サーバーの信頼性向上（カスタムドメイン化、監視など）
- 複数端末間でのレシピ同期・バックエンド導入（現状は端末ごとに別データ）
- PWA化（オフライン対応・ホーム画面への追加）
- Instagram以外のSNS投稿取り込みの可否検討
