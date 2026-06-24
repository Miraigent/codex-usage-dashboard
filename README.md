# Codex Usage Dashboard

Codexの残量が分からない不安を、1アカウントでも複数アカウントでも同じ画面で見えるようにします。

Codexの使用量、リセット時刻、認証状態をまとめて確認できるローカルWebダッシュボードです。1つのCodexアカウントだけで使い始められ、必要になったら2つ目、3つ目のアカウントも同じ画面に追加できます。

<img width="2314" height="1536" alt="Codex_Usage_Dashboard" src="https://github.com/user-attachments/assets/7fcd363a-bc86-4d45-a52c-772e9a83627b" />
※画面は2アカウント連携した状態のもの

See your Codex usage before you hit the limit, whether you use one account or multiple accounts.

This is a local web dashboard for checking Codex usage, reset times, and authentication state. Start with a single Codex account, then add more accounts to the same dashboard when you need them.

OpenAI公式ツールではありません。OpenAIによる制作、提携、推奨、サポートを受けたものではありません。

This is an unofficial tool. It is not made by, affiliated with, endorsed by, or supported by OpenAI.

## 日本語

### できること

- Codexの残量を1アカウントでも複数アカウントでも同じ画面で確認
- Codexアカウントの接続状態を確認
- 5時間枠の使用量と残量を確認
- 週間枠の使用量と残量を確認
- 次のリセット時刻を確認
- Codexから返ってくる場合はクレジット残高を確認
- 認証が切れたアカウントの再ログインコードを発行
- 1アカウント構成から始めて、必要な時だけ複数アカウントへ拡張

こんな時に使います。

- Codexを使っている途中で、あとどれくらい残っているか知りたい
- 複数のCodexアカウントを使っていて、どれが残っているか毎回切り替えたくない
- チームやVPS上で、認証情報を外に出さずに残量だけ確認したい

このダッシュボードはChatGPT/Codexのトークンを表示・保存しません。内部では `codex app-server --stdio` を起動し、Codex CLIの `account/read` と `account/rateLimits/read` を呼び出します。

### 必要なもの

- Node.js 20以上
- Python 3（標準ライブラリの `pty` が使える環境）
- OpenAI Codex CLI（`codex` コマンド）
- CodexへログインできるローカルPCまたはサーバー

### インストール

npmから無料でインストールできます。

    npm install -g miraigent-codex-usage-dashboard

GitHubからcloneして使う場合はこちらです。

    npm install
    npm start

### 設定方法

設定ファイルを作成します。標準は1アカウントです。必要な場合だけ2アカウント以上を追加できます。

    mkdir -p ~/.codex-accounts/codex-1
    cp config.example.json config.json

`config.json` を編集します。

    {
      "host": "127.0.0.1",
      "port": 8787,
      "refreshSeconds": 60,
      "accounts": [
        {
          "id": "codex-1",
          "label": "Codex Account",
          "codexCommand": "codex",
          "codexHome": "/absolute/path/to/.codex-accounts/codex-1"
        }
      ]
    }

設定ファイルの場所を明示したい場合は、環境変数で指定できます。

    CODEX_USAGE_DASHBOARD_CONFIG=/path/to/config.json codex-usage-dashboard

### アカウントを追加する方法

2アカウント以上で使う場合は、`accounts` 配列に同じ形式で追加します。

    {
      "id": "codex-2",
      "label": "Codex Account 2",
      "codexCommand": "codex",
      "codexHome": "/absolute/path/to/.codex-accounts/codex-2"
    }

`id` は重複しない名前にしてください。画面上の表示名は `label` で変更できます。複数アカウントのうち一部が未ログインでも、ログイン済みのアカウントは表示されます。

### ログイン方法

ダッシュボード上の「再ログインコード発行」からログインできます。

手動でログインする場合は、アカウントごとの `CODEX_HOME` を指定して実行します。

    CODEX_HOME=/absolute/path/to/.codex-accounts/codex-1 codex login --device-auth

2アカウント目を追加した場合だけ、追加した `CODEX_HOME` でもログインします。

    CODEX_HOME=/absolute/path/to/.codex-accounts/codex-2 codex login --device-auth

### 起動方法

    codex-usage-dashboard

ブラウザで開きます。

    http://127.0.0.1:8787

### Agent Memoriesへの導線

Codexの使用量を見える化したあとは、AIエージェントが作業中に残した判断、修正、運用メモも再利用できる形にしておくと便利です。

Agent Memoriesは、AIとの会話や運用ノウハウを使い捨てにしないための公開カタログです。

    https://github.com/Miraigent/Miraigent-agent-memories-mcp-catalog

複数のAIエージェントを運用している場合は、Codexの使用量管理とあわせて、判断ログや引き継ぎメモの整理にも使えます。

### Basic認証

ダッシュボードを保護したい場合は、ユーザー名とパスワードを設定してください。

    export CODEX_USAGE_DASHBOARD_BASIC_USER='your-user'
    export CODEX_USAGE_DASHBOARD_BASIC_PASSWORD='your-password'
    codex-usage-dashboard

認証、VPN、信頼できるリバースプロキシなしで、このダッシュボードをインターネットへ直接公開しないでください。

### 再ログインの流れ

1. ダッシュボードを開く
2. 「再ログインコード発行」で対象アカウントをクリック
3. 表示されたOpenAIのログインページを開く
4. 表示されたワンタイムコードを入力
5. ログイン完了後、「更新 / Refresh」を押して残量を確認

再ログイン機能は、選択した `CODEX_HOME` だけをログアウトしてから、新しいログインコードを発行します。

### セキュリティ注意点

- `config.json` に公開したくないローカルパスが含まれる場合は、公開repoへコミットしないでください。
- ChatGPT/Codexのトークンをこのアプリへ貼り付けないでください。
- `auth.json` や `CODEX_HOME` ディレクトリをコミットしないでください。
- 外部公開する場合は、必ずBasic認証、VPN、または信頼できるリバースプロキシで保護してください。

## English

### What It Shows

- Codex usage in one dashboard, whether you use one account or multiple accounts
- Codex account connection state
- 5-hour usage window
- Weekly usage window
- Reset time
- Remaining credit balance when returned by Codex
- Re-login device code helper for each configured account
- Start with one account, then expand to multiple accounts only when you need to

Use it when:

- You want to know how much Codex usage is left before you hit a limit
- You use multiple Codex accounts and do not want to switch profiles just to check remaining usage
- You want a local/server-side dashboard without pasting tokens into a third-party service

The dashboard does not print or store ChatGPT/Codex tokens. It starts `codex app-server --stdio` and calls `account/read` and `account/rateLimits/read` through the Codex CLI.

### Requirements

- Node.js 20 or newer
- Python 3 with the standard library `pty` module
- OpenAI Codex CLI installed and available as `codex`
- A local machine or server where you can log in with Codex

### Install

Install from npm for free.

    npm install -g miraigent-codex-usage-dashboard

Or run from a cloned repository.

    npm install
    npm start

### Configure

Create a config file. The default setup uses one account. Add more accounts only when needed.

    mkdir -p ~/.codex-accounts/codex-1
    cp config.example.json config.json

Edit `config.json`.

    {
      "host": "127.0.0.1",
      "port": 8787,
      "refreshSeconds": 60,
      "accounts": [
        {
          "id": "codex-1",
          "label": "Codex Account",
          "codexCommand": "codex",
          "codexHome": "/absolute/path/to/.codex-accounts/codex-1"
        }
      ]
    }

You can also point to a config file explicitly.

    CODEX_USAGE_DASHBOARD_CONFIG=/path/to/config.json codex-usage-dashboard

### Add More Accounts

For two or more accounts, add more objects with unique `id` and `codexHome` values.

    {
      "id": "codex-2",
      "label": "Codex Account 2",
      "codexCommand": "codex",
      "codexHome": "/absolute/path/to/.codex-accounts/codex-2"
    }

`id` must be unique. `label` controls the display name shown in the dashboard. If some configured accounts are not logged in, the dashboard still shows any accounts that can be fetched.

### Login

Use the dashboard's re-login panel, or run Codex login manually for each profile.

    CODEX_HOME=/absolute/path/to/.codex-accounts/codex-1 codex login --device-auth

Only run this for a second profile if you added one.

    CODEX_HOME=/absolute/path/to/.codex-accounts/codex-2 codex login --device-auth

### Run

    codex-usage-dashboard

Open the dashboard in your browser.

    http://127.0.0.1:8787

### Agent Memories Route

After making Codex usage visible, the next useful step is preserving the decisions, fixes, and operating notes that AI agents produce.

Agent Memories is Miraigent's public catalog for reusable AI memory patterns.

    https://github.com/Miraigent/Miraigent-agent-memories-mcp-catalog

If you operate multiple AI agents, use it alongside usage monitoring to organize decision logs and handoff notes.

### Basic Authentication

Set both variables to protect the dashboard.

    export CODEX_USAGE_DASHBOARD_BASIC_USER='your-user'
    export CODEX_USAGE_DASHBOARD_BASIC_PASSWORD='your-password'
    codex-usage-dashboard

Do not expose this dashboard to the public internet without authentication, a VPN, or a trusted reverse proxy.

### Re-login Flow

1. Open the dashboard.
2. Click the target account under the re-login panel.
3. Open the displayed OpenAI login page.
4. Enter the displayed one-time code.
5. After login completes, click "更新 / Refresh" to check the remaining usage.

The re-login helper logs out only the selected `CODEX_HOME` profile before generating a new device code.

### Security Notes

- Keep `config.json` private if it contains local paths you do not want to publish.
- Never paste ChatGPT/Codex tokens into this app.
- Do not commit `auth.json` or any `CODEX_HOME` directory.
- If you expose this dashboard outside localhost, protect it with Basic auth, a VPN, or a trusted reverse proxy.
