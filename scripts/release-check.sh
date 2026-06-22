#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TEMP_ENV_CREATED=false
cleanup() {
  if [ "$TEMP_ENV_CREATED" = "true" ]; then
    rm -f .env
  fi
}
trap cleanup EXIT

if ! command -v docker >/dev/null 2>&1; then
  echo "Missing required command: docker"
  exit 1
fi

docker compose version >/dev/null

if [ ! -f .env ]; then
  cp .env.example .env
  TEMP_ENV_CREATED=true
fi

echo "Validating Docker Compose configuration..."
docker compose config >/dev/null

echo "Running release checks inside Docker..."
docker build --target test -t bookingphotobooth:release-check .

echo "Building production Docker image..."
docker compose build app

echo "Checking runtime toolchain..."
corepack_version="$(docker compose run --rm --no-deps --entrypoint corepack app --version)"
pnpm_version="$(docker compose run --rm --no-deps --entrypoint pnpm app --version)"
openssl_version="$(docker compose run --rm --no-deps --entrypoint openssl app version)"

echo "Corepack: ${corepack_version}"
echo "pnpm: ${pnpm_version}"
echo "OpenSSL: ${openssl_version}"

if [ "$corepack_version" != "0.35.0" ]; then
  echo "Expected Corepack 0.35.0, got ${corepack_version}"
  exit 1
fi

if [ "$pnpm_version" != "10.23.0" ]; then
  echo "Expected pnpm 10.23.0, got ${pnpm_version}"
  exit 1
fi

echo "Running Prisma validate/generate in runtime image..."
docker compose run --rm --no-deps --entrypoint pnpm app prisma validate
docker compose run --rm --no-deps --entrypoint pnpm app db:generate

echo "Release check completed successfully."
