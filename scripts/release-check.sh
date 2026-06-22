#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

compose() {
  docker compose --env-file .env.example "$@"
}

fail() {
  echo "Release check failed: $1"
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "missing required command: $1"
  fi
}

assert_clean_worktree() {
  if [ -n "$(git status --porcelain --untracked-files=normal)" ]; then
    git status --short
    fail "working tree must be clean before release-check"
  fi
}

assert_script_mode() {
  local script="$1"
  local mode

  mode="$(git ls-files -s -- "$script" | awk '{print $1}')"
  if [ "$mode" != "100755" ]; then
    fail "${script} must be committed as executable mode 100755; current mode is ${mode:-untracked}"
  fi
}

assert_ignored() {
  local path="$1"
  if ! git check-ignore -q "$path"; then
    fail "${path} must be ignored by .gitignore"
  fi
}

assert_no_git_grep_match() {
  local description="$1"
  shift

  if git grep -n "$@" >/tmp/bookingphotobooth-release-grep.txt; then
    cat /tmp/bookingphotobooth-release-grep.txt
    rm -f /tmp/bookingphotobooth-release-grep.txt
    fail "$description"
  fi

  rm -f /tmp/bookingphotobooth-release-grep.txt
}

assert_compose_static_contract() {
  if ! grep -Fq '${APP_BIND_ADDRESS:-127.0.0.1}:${APP_PORT:-3000}:3000' docker-compose.yml; then
    fail "docker-compose.yml must bind app with APP_BIND_ADDRESS defaulting to 127.0.0.1"
  fi

  if awk '/^[[:space:]]{2}db:/{in_db=1} /^[[:space:]]{2}app:/{in_db=0} in_db && /^[[:space:]]+ports:/{found=1} END{exit found ? 0 : 1}' docker-compose.yml; then
    fail "db service must not publish ports"
  fi

  if awk '/^[[:space:]]{2}app:/{in_app=1} /^[[:space:]]{2}[a-zA-Z0-9_-]+:/{if ($1 != "app:") in_app=0} in_app && /CMD-SHELL/{found=1} END{exit found ? 0 : 1}' docker-compose.yml; then
    fail "app Docker healthcheck should use exec-form CMD with node, not CMD-SHELL"
  fi
}

echo "Running static release checks..."
assert_clean_worktree
assert_script_mode scripts/deploy.sh
assert_script_mode scripts/update.sh
assert_script_mode scripts/docker-entrypoint.sh
assert_script_mode scripts/release-check.sh
assert_ignored .env
assert_ignored .env.save
assert_compose_static_contract

test -f pnpm-lock.yaml || fail "pnpm-lock.yaml is required"
test -d prisma/migrations || fail "prisma/migrations is required"
test -f src/app/api/health/route.ts || fail "health endpoint is required"

assert_no_git_grep_match "production IP must not be hard-coded in source" "10\\.10\\.10\\.100" -- . ":(exclude)docs/**" ":(exclude)README.md"
assert_no_git_grep_match "production domain must not be hard-coded outside docs/examples" "momentme\\.duckdns\\.org" -- . ":(exclude)docs/**" ":(exclude)README.md" ":(exclude).env.example"
assert_no_git_grep_match "production scripts must not delete Docker volumes" "docker compose down -v" -- scripts/deploy.sh scripts/update.sh scripts/docker-entrypoint.sh
assert_no_git_grep_match "production scripts must not reset Prisma migrations" "prisma migrate reset" -- scripts/deploy.sh scripts/update.sh scripts/docker-entrypoint.sh

require_command docker
docker compose version >/dev/null

echo "Validating Docker Compose configuration..."
compose config >/dev/null

echo "Running release checks inside Docker..."
docker build --target test -t bookingphotobooth:release-check .

echo "Building production Docker image..."
compose build app

echo "Checking runtime toolchain..."
corepack_version="$(compose run --rm --no-deps --entrypoint corepack app --version)"
pnpm_version="$(compose run --rm --no-deps --entrypoint pnpm app --version)"
openssl_version="$(compose run --rm --no-deps --entrypoint openssl app version)"

echo "Corepack: ${corepack_version}"
echo "pnpm: ${pnpm_version}"
echo "OpenSSL: ${openssl_version}"

if [ "$corepack_version" != "0.35.0" ]; then
  fail "expected Corepack 0.35.0, got ${corepack_version}"
fi

if [ "$pnpm_version" != "10.23.0" ]; then
  fail "expected pnpm 10.23.0, got ${pnpm_version}"
fi

echo "Running Prisma validate/generate in runtime image..."
compose run --rm --no-deps --entrypoint pnpm app prisma validate
compose run --rm --no-deps --entrypoint pnpm app db:generate
compose run --rm --no-deps --entrypoint node app -e 'const { PrismaClient } = require("@prisma/client"); new PrismaClient(); console.log("Prisma Client OK")'

echo "Release check completed successfully."
