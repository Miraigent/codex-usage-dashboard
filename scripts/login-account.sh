#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <account-id>" >&2
  exit 2
fi

account="$1"

accounts_dir="${CODEX_ACCOUNTS_DIR:-$HOME/.codex-accounts}"
export CODEX_HOME="$accounts_dir/$account"
mkdir -p "$CODEX_HOME"
chmod 700 "$CODEX_HOME"

echo "Logging in $account with CODEX_HOME=$CODEX_HOME"
echo "Do not paste tokens into chat. Complete the browser/device flow shown by Codex."
exec codex login --device-auth
