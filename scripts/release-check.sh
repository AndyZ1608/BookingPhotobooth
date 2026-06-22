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

echo "Release check completed successfully."
