#!/usr/bin/env bash
set -euo pipefail

REPO="${CODEX_COMPONENTS_REPO:-moonmidas/codex-components}"
REF="${CODEX_COMPONENTS_REF:-main}"
DEST="${CODEX_COMPONENTS_SOURCE:-$HOME/.codex-components/source}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required to install Codex Components." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required to install Codex Components." >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
if [ ! -d "$DEST/.git" ]; then
  git clone "https://github.com/$REPO.git" "$DEST"
fi

git -C "$DEST" fetch origin "$REF"
git -C "$DEST" checkout "$REF"
node "$DEST/scripts/install.mjs"
