#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -gt 0 ]; then
  accounts=("$@")
elif [ -n "${CODEX_USAGE_ACCOUNTS:-}" ]; then
  read -r -a accounts <<< "$CODEX_USAGE_ACCOUNTS"
else
  accounts=(codex-1)
fi

for account in "${accounts[@]}"; do
  accounts_dir="${CODEX_ACCOUNTS_DIR:-$HOME/.codex-accounts}"
  export CODEX_HOME="$accounts_dir/$account"
  echo "== $account =="
  if [ ! -d "$CODEX_HOME" ]; then
    echo "missing CODEX_HOME: $CODEX_HOME"
    continue
  fi
  codex login status 2>&1 | sed -E 's/[A-Za-z0-9_=-]{24,}/<redacted>/g' || true
done
