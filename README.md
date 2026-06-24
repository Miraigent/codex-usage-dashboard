# Codex Usage Dashboard

Codexの使用量、リセット時刻、認証状態を、1アカウントから複数アカウントまでまとめて確認できるローカルWebダッシュボードです。

OpenAI公式ツールではありません。OpenAIによる制作、提携、推奨、サポートを受けたものではありません。

## できること

- Codexアカウントの接続状態を確認
- 5時間枠の使用量と残量を確認
- 週間枠の使用量と残量を確認
- 次のリセット時刻を確認
- Codexから返ってくる場合はクレジット残高を確認
- 認証が切れたアカウントの再ログインコードを発行
- 1アカウントでも、2アカウント以上でも利用可能

このダッシュボードはChatGPT/Codexのトークンを表示・保存しません。内部では `codex app-server --stdio` を起動し、Codex CLIの `account/read` と `account/rateLimits/read` を呼び出します。

## 必要なもの

- Node.js 20以上
- Python 3（標準ライブラリの `pty` が使える環境）
- OpenAI Codex CLI（`codex` コマンド）
- CodexへログインできるローカルPCまたはサーバー

## インストール

npmから無料でインストールできます。

    npm install -g miraigent-codex-usage-dashboard

GitHubからcloneして使う場合はこちらです。

    npm install
    npm start

## 設定方法

設定ファイルを作成します。1アカウントでも、2アカウントでも、3アカウント以上でも使えます。

    mkdir -p ~/.codex-accounts/codex-1 ~/.codex-accounts/codex-2
    cp config.example.json config.json

`config.json` を編集します。

    {
      "host": "127.0.0.1",
      "port": 8787,
      "refreshSeconds": 60,
      "accounts": [
        {
          "id": "codex-1",
          "label": "Codexアカウント1",
          "codexCommand": "codex",
          "codexHome": "/absolute/path/to/.codex-accounts/codex-1"
        },
        {
          "id": "codex-2",
          "label": "Codexアカウント2",
          "codexCommand": "codex",
          "codexHome": "/absolute/path/to/.codex-accounts/codex-2"
        }
      ]
    }

設定ファイルの場所を明示したい場合は、環境変数で指定できます。

    CODEX_USAGE_DASHBOARD_CONFIG=/path/to/config.json codex-usage-dashboard

## アカウントを追加する方法

1アカウントだけで使う場合は、`accounts` 配列に1つだけ残します。

3アカウント以上で使う場合は、`accounts` 配列に同じ形式で追加します。

    {
      "id": "codex-3",
      "label": "Codexアカウント3",
      "codexCommand": "codex",
      "codexHome": "/absolute/path/to/.codex-accounts/codex-3"
    }

`id` は重複しない名前にしてください。画面上の表示名は `label` で変更できます。

## ログイン方法

ダッシュボード上の「再ログインコード発行」からログインできます。

手動でログインする場合は、アカウントごとの `CODEX_HOME` を指定して実行します。

    CODEX_HOME=/absolute/path/to/.codex-accounts/codex-1 codex login --device-auth
    CODEX_HOME=/absolute/path/to/.codex-accounts/codex-2 codex login --device-auth

## 起動方法

    codex-usage-dashboard

ブラウザで開きます。

    http://127.0.0.1:8787

## Agent Memoriesへの導線

Codexの使用量を見える化したあとは、AIエージェントが作業中に残した判断、修正、運用メモも再利用できる形にしておくと便利です。

Agent Memoriesは、AIとの会話や運用ノウハウを使い捨てにしないための公開カタログです。

    https://github.com/Miraigent/Miraigent-agent-memories-mcp-catalog

複数のAIエージェントを運用している場合は、Codexの使用量管理とあわせて、判断ログや引き継ぎメモの整理にも使えます。

## Basic認証

ダッシュボードを保護したい場合は、ユーザー名とパスワードを設定してください。

    export CODEX_USAGE_DASHBOARD_BASIC_USER='your-user'
    export CODEX_USAGE_DASHBOARD_BASIC_PASSWORD='your-password'
    codex-usage-dashboard

認証、VPN、信頼できるリバースプロキシなしで、このダッシュボードをインターネットへ直接公開しないでください。

## 再ログインの流れ

認証が切れた場合は、次の手順で再ログインします。

1. ダッシュボードを開く
2. 「再ログインコード発行」で対象アカウントをクリック
3. 表示されたOpenAIのログインページを開く
4. 表示されたワンタイムコードを入力
5. ログイン完了後、「更新」を押して残量を確認

再ログイン機能は、選択した `CODEX_HOME` だけをログアウトしてから、新しいログインコードを発行します。

## セキュリティ注意点

- `config.json` に公開したくないローカルパスが含まれる場合は、公開repoへコミットしないでください。
- ChatGPT/Codexのトークンをこのアプリへ貼り付けないでください。
- `auth.json` や `CODEX_HOME` ディレクトリをコミットしないでください。
- 外部公開する場合は、必ずBasic認証、VPN、または信頼できるリバースプロキシで保護してください。

