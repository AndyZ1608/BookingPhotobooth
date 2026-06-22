#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

print_local_change_guidance() {
  echo "Working tree has local changes. Production should not contain local source edits."
  echo ""
  echo "Local changes:"
  git status --short
  echo ""
  echo "Move runtime backups outside this repository and keep .env as the only local runtime file."
  echo "Do not run automatic reset or clean commands unless you have manually backed up anything important."
  echo "After resolving local changes, rerun: ./scripts/update.sh"
}

require_clean_worktree() {
  if [ -n "$(git status --porcelain --untracked-files=normal)" ]; then
    print_local_change_guidance
    exit 1
  fi
}

require_clean_worktree

PREVIOUS_COMMIT="$(git rev-parse HEAD)"
echo "Previous commit: ${PREVIOUS_COMMIT}"

echo "Fetching updates..."
git fetch --prune origin

echo "Pulling fast-forward update..."
git pull --ff-only

CURRENT_COMMIT="$(git rev-parse HEAD)"
echo "Current commit: ${CURRENT_COMMIT}"

echo "Running deployment..."
"$ROOT_DIR/scripts/deploy.sh"

echo "Verifying repository cleanliness after deployment..."
if [ -n "$(git status --porcelain --untracked-files=normal)" ]; then
  echo "Deployment completed, but the repository is no longer clean."
  echo "This indicates a release script or runtime process wrote files inside the repository."
  git status --short
  exit 1
fi

echo "Update completed successfully."
