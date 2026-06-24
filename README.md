# Codex Usage Dashboard

Local web dashboard for viewing Codex account usage limits across multiple CODEX_HOME profiles.

This is an unofficial tool. It is not made by, affiliated with, endorsed by, or supported by OpenAI.

## What It Shows

- Codex account connection state
- 5-hour usage window
- Weekly usage window
- Reset time
- Remaining credit balance when returned by Codex
- Re-login device code helper for each configured account
- One account or any number of accounts, driven by the accounts array in config.json

The dashboard does not print or store ChatGPT/Codex tokens. It starts codex app-server --stdio and calls account/read and account/rateLimits/read.

## Requirements

- Node.js 20 or newer
- Python 3 with the standard library pty module
- OpenAI Codex CLI installed and available as codex
- A local machine or server where you can log in with Codex

## Install

    npm install -g miraigent-codex-usage-dashboard

Or run from a cloned repository:

    npm install
    npm start

## Configure

Create a config file. Use one account, two accounts, or any number of accounts:

    mkdir -p ~/.codex-accounts/codex-1 ~/.codex-accounts/codex-2
    cp config.example.json config.json

Edit config.json:

    {
      "host": "127.0.0.1",
      "port": 8787,
      "refreshSeconds": 60,
      "accounts": [
        {
          "id": "codex-1",
          "label": "Codex Account 1",
          "codexCommand": "codex",
          "codexHome": "/absolute/path/to/.codex-accounts/codex-1"
        },
        {
          "id": "codex-2",
          "label": "Codex Account 2",
          "codexCommand": "codex",
          "codexHome": "/absolute/path/to/.codex-accounts/codex-2"
        }
      ]
    }

You can also point to a config file explicitly:

    CODEX_USAGE_DASHBOARD_CONFIG=/path/to/config.json codex-usage-dashboard

## Login

Use the dashboard's re-login panel, or run Codex login manually for each profile:

    CODEX_HOME=/absolute/path/to/.codex-accounts/codex-1 codex login --device-auth
    CODEX_HOME=/absolute/path/to/.codex-accounts/codex-2 codex login --device-auth

For a single-account setup, keep only one object in accounts.

For three or more accounts, add more objects with unique id and codexHome values.

## Run

    codex-usage-dashboard

Open:

    http://127.0.0.1:8787

## Basic Authentication

Set both variables to protect the dashboard:

    export CODEX_USAGE_DASHBOARD_BASIC_USER='your-user'
    export CODEX_USAGE_DASHBOARD_BASIC_PASSWORD='your-password'
    codex-usage-dashboard

Do not expose this dashboard to the public internet without authentication, a VPN, or a trusted reverse proxy.

## Re-login Flow

When auth expires:

1. Open the dashboard.
2. Click codex-1 or codex-2 under Re-login.
3. Open the displayed OpenAI device login link.
4. Enter the displayed one-time code.
5. Click Refresh after login completes.

The re-login helper logs out only the selected CODEX_HOME profile before generating a new device code.

## Security Notes

- Keep config.json private if it contains local paths you do not want to publish.
- Never paste ChatGPT/Codex tokens into this app.
- Do not commit auth.json or any CODEX_HOME directory.
- Bind to 127.0.0.1 unless you have an authenticated access layer.
