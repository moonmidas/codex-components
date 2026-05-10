#!/usr/bin/env bash
set -euo pipefail

# Codex Components bootstrap:
# 1. Downloads this repository.
# 2. Runs scripts/install.mjs.
# 3. That installer clones/builds Codex++, patches the local Codex app,
#    installs the Codex Components tweak and skill, and applies the default
#    sidebar setting overrides only for first-time Codex++ installs.
#
# Existing Codex++ installs:
# - Uses CODEX_PLUSPLUS_HOME when set.
# - Otherwise uses the normal Codex++ home:
#   ~/Library/Application Support/codex-plusplus
# - Preserves existing tweak settings.
# - May re-patch and re-sign the local Codex app, which is normal Codex++
#   behavior on macOS.

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
  echo "Cloning Codex Components bootstrap into $DEST..."
  git clone "https://github.com/$REPO.git" "$DEST"
fi

echo "Updating Codex Components bootstrap from $REPO@$REF..."
git -C "$DEST" fetch origin "$REF"
git -C "$DEST" checkout "$REF"

echo "Running installer. This will download/build Codex++ and patch the local Codex app..."
node "$DEST/scripts/install.mjs"
