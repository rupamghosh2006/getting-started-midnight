#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPACT_VERSION="${COMPACT_VERSION:-0.31.1}"

if ! command -v compact >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -LsSf \
    https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
  export PATH="$HOME/.compact/bin:$PATH"
fi

compact update "$COMPACT_VERSION"
compact compile "+$COMPACT_VERSION" \
  "$ROOT/contracts/hello-world.compact" \
  "$ROOT/contracts/managed/hello-world"

node "$ROOT/frontend/sync-zk-assets.mjs"
next build
