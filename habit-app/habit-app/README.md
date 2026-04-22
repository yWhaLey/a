# 習慣トラッカー - デプロイ手順

## フォルダ構成
```
habit-app/
├── api/
│   └── chat.js        ← サーバー側（APIキーはここで管理）
├── public/
│   └── index.html     ← フロントエンド
├── vercel.json
├── .env.example
├── .gitignore
└── README.md
```

## デプロイ手順

### 1. GitHubにアップロード
1. github.com でアカウント作成
2. 「New repository」でリポジトリを作成
3. このフォルダの中身をアップロード
   ※ `.env.local` は絶対にアップロードしないこと！

### 2. Vercelに接続
1. vercel.com でアカウント作成（GitHubでログイン）
2. 「Add New Project」→ GitHubのリポジトリを選択
3. 「Environment Variables」に以下を追加：
   - `ANTHROPIC_API_KEY` = あなたのAPIキー
   - `ALLOWED_ORIGIN` = https://あなたのドメイン.vercel.app
4. 「Deploy」をクリック

### 3. 完了！
デプロイ完了後、発行されたURLでアプリが使えます。

## セキュリティのポイント
- APIキーは Vercel の環境変数にのみ保存
- フロントエンドのコードにAPIキーは一切書かない
- レート制限で1人あたり1時間20回まで
- ユーザーのメッセージ内容をサーバーログに残さない
