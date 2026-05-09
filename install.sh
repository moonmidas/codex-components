#!/usr/bin/env bash
set -euo pipefail

REPO="${CODEXMOD_REPO:-moonmidas/codexmod-components}"
REF="${CODEXMOD_REF:-main}"
DEST="${CODEXMOD_SOURCE:-$HOME/.codexmod/components}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required to install CodexMod Components." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required to install CodexMod Components." >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
if [ ! -d "$DEST/.git" ]; then
  git clone "https://github.com/$REPO.git" "$DEST"
fi

git -C "$DEST" fetch origin "$REF"
git -C "$DEST" checkout "$REF"
node "$DEST/scripts/install.mjs"
