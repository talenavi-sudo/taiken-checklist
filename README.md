# 体験チェックリスト

体験事業向けのチェックリスト管理アプリ。
Googleカレンダーの予約と連動し、体験ごとの準備・片付けチェックリストを管理。

## ファイル構成

```
taiken-checklist/
├── index.html              # メインページ
├── css/
│   └── style.css           # スタイル
├── js/
│   ├── store.js            # データ管理
│   └── app.js              # UI制御
├── functions/              # Cloudflare Pages Functions（バックエンド）
│   └── api/
│       └── calendar.js     # Google Calendar API連携
└── README.md
```

## デプロイ手順

### 1. GitHubリポジトリを作成

1. GitHub (https://github.com) を開く
2. 右上「+」→「New repository」
3. Repository name: `taiken-checklist`
4. 「Public」を選択 →「Create repository」
5. このプロジェクトのファイルをすべてpush

```bash
cd taiken-checklist
git init
git add .
git commit -m "初回コミット"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/taiken-checklist.git
git push -u origin main
```

### 2. Cloudflare Pagesに接続

1. Cloudflare Dashboard (https://dash.cloudflare.com/) を開く
2. 左メニュー →「Workers & Pages」→「作成」→「Pages」→「Gitに接続」
3. GitHubアカウントを接続 →「taiken-checklist」リポジトリを選択
4. 設定:
   - プロジェクト名: `taiken-checklist`
   - プロダクションブランチ: `main`
   - ビルドコマンド: **空欄**（入力しない）
   - ビルド出力ディレクトリ: **`/`**（スラッシュだけ）
5. 「保存してデプロイ」

### 3. 環境変数を設定（Google Calendar連携）

1. Cloudflare Dashboard → Workers & Pages → taiken-checklist
2. 「設定」タブ →「環境変数」→「プロダクション」の「変数を追加」
3. 以下の3つを追加:

| 変数名 | 値 |
|--------|---|
| `GOOGLE_CLIENT_EMAIL` | JSONファイル内の `client_email` の値 |
| `GOOGLE_PRIVATE_KEY` | JSONファイル内の `private_key` の値（`-----BEGIN...` から `...END-----\n` まで全部） |
| `GOOGLE_CALENDAR_ID` | `talenavi@zencraftjp.com` |

**GOOGLE_PRIVATE_KEY の注意点:**
- JSONファイルをテキストエディタで開く
- `"private_key": "-----BEGIN PRIVATE KEY-----\n...` の `"` の中身をすべてコピー
- `\n` はそのままコピーしてOK（Cloudflareが自動処理）

4. 「保存してデプロイ」をクリック

### 4. 動作確認

デプロイ完了後、以下のURLでアクセス:
- `https://taiken-checklist.pages.dev`（Cloudflareが自動で割り当て）

予約一覧にGoogleカレンダーの予定が表示されればOK！
