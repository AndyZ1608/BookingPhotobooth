#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -n "$(git status --porcelain --untracked-files=normal)" ]; then
  echo "Working tree has local changes. Commit, stash, or remove them before updating."
  git status --short
  exit 1
fi

git fetch --all --prune
git pull --ff-only
./scripts/deploy.sh
