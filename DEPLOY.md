# 公開手順（GitHub → Vercel）

パソコンにNode.jsなどをインストールしなくても、ブラウザだけで公開できます。

## ステップ1: GitHubにアップロードする

1. https://github.com でアカウント作成・ログイン
2. 右上の「+」→「New repository」
3. Repository name: `cleaning-app`（何でもOK）、Public/Privateはどちらでも可 → 「Create repository」
4. 作られたページに「uploading an existing file」という青いリンクがあるのでクリック
5. このフォルダの中身を**全部**、ドラッグ＆ドロップでアップロード
   - フォルダごとドラッグすれば、中の階層（`pages/api/beds24/sync.js`など）も保たれます
   - `.env.local` は絶対にアップロードしないでください（`.gitignore`に入れているので、ファイルを作らなければ問題ありません）
6. 一番下の「Commit changes」ボタンで確定

## ステップ2: Vercelに公開する

1. https://vercel.com を開き、「Continue with GitHub」でログイン（GitHubアカウントで連携）
2. 「Add New...」→「Project」
3. さっき作った `cleaning-app` リポジトリを選んで「Import」
4. 「Environment Variables」という欄に、以下を1つずつ追加
   ```
   SUPABASE_URL = (SupabaseのプロジェクトURL)
   SUPABASE_SERVICE_ROLE_KEY = (Supabaseの Settings > API にある service_role キー)
   BEDS24_REFRESH_TOKEN_ACCOUNT1 = (アカウント1のrefreshToken)
   BEDS24_REFRESH_TOKEN_ACCOUNT2 = (アカウント2のrefreshToken)
   ```
   - SupabaseのURL/キーは、Supabaseの管理画面 → 左メニュー「Project Settings」→「API」で確認できます
5. 「Deploy」ボタンをクリック
6. 1〜2分待つと、`https://cleaning-app-xxxx.vercel.app` のようなURLが発行されます

## ステップ3: 動作確認

1. 発行されたURLをブラウザで開く
2. 右上の「BEDS24と今すぐ同期」ボタンを押す
3. しばらくすると、実際の予約データが清掃カレンダーに反映されます

## ステップ4（任意）: BEDS24のWebhookを設定する

同期ボタンを毎回押さなくても、予約が入るたびに自動反映したい場合:

1. BEDS24の管理画面 → 「Marketplace」→「API」→「Webhooks」
2. 通知先URLに以下を設定（**account1**と**account2**それぞれ）
   ```
   https://あなたのVercelのURL/api/beds24/webhook?account=account1
   https://あなたのVercelのURL/api/beds24/webhook?account=account2
   ```

## コードを直したくなったら

GitHubの画面で該当ファイルを開き、鉛筆マーク（Edit）で直接編集して「Commit changes」すれば、
Vercelが自動的に再デプロイしてくれます（何もインストールしなくてOKです）。
