#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NO_CACHE=false
if [ "${1:-}" = "--no-cache" ]; then
  NO_CACHE=true
elif [ "${1:-}" != "" ]; then
  echo "Usage: ./scripts/deploy.sh [--no-cache]"
  exit 1
fi

on_error() {
  local exit_code=$?
  set +e
  echo "Deployment failed with exit code ${exit_code}."
  echo ""
  echo "Recent app logs:"
  docker compose logs --tail=200 app
  echo ""
  echo "Recent database logs:"
  docker compose logs --tail=120 db
  echo ""
  echo "Rollback guidance: checkout a known-good code revision and rerun ./scripts/deploy.sh."
  echo "Do not run docker compose down -v unless you intentionally want to delete database data."
  exit "$exit_code"
}

trap on_error ERR

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

read_env_value() {
  local name="$1"
  local line value
  set +e
  line="$(grep -E "^[[:space:]]*${name}=" .env | tail -n 1)"
  set -e
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
}

require_env() {
  local name="$1"
  local value
  value="$(read_env_value "$name")"
  if [ -z "$value" ]; then
    echo "Missing required .env variable: $name"
    exit 1
  fi
}

require_command docker
docker compose version >/dev/null

if [ ! -f .env ]; then
  echo "Missing .env. Copy .env.example to .env and fill production values."
  exit 1
fi

require_env SESSION_SECRET
require_env ADMIN_USERNAME
require_env ADMIN_EMAIL
require_env ADMIN_PASSWORD
require_env NEXT_PUBLIC_APP_URL

session_secret_length="$(read_env_value SESSION_SECRET | wc -c | tr -d ' ')"
if [ "$session_secret_length" -lt 32 ]; then
  echo "SESSION_SECRET must have at least 32 characters."
  exit 1
fi

session_cookie_secure="$(read_env_value SESSION_COOKIE_SECURE)"
if [ -n "$session_cookie_secure" ] && [ "$session_cookie_secure" != "true" ] && [ "$session_cookie_secure" != "false" ]; then
  echo "SESSION_COOKIE_SECURE must be true or false."
  exit 1
fi

admin_session_ttl_hours="$(read_env_value ADMIN_SESSION_TTL_HOURS)"
if [ -n "$admin_session_ttl_hours" ] && ! [[ "$admin_session_ttl_hours" =~ ^[0-9]+$ ]]; then
  echo "ADMIN_SESSION_TTL_HOURS must be a positive integer."
  exit 1
fi
if [ -n "$admin_session_ttl_hours" ] && [ "$admin_session_ttl_hours" -lt 1 ]; then
  echo "ADMIN_SESSION_TTL_HOURS must be at least 1."
  exit 1
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  export APP_IMAGE_TAG="$(git rev-parse --short HEAD)"
else
  export APP_IMAGE_TAG="local"
fi

app_port="$(read_env_value APP_PORT)"
APP_URL="http://localhost:${app_port:-3000}"

echo "Validating Docker Compose configuration..."
docker compose config >/dev/null

echo "Building Docker image..."
if [ "$NO_CACHE" = "true" ]; then
  docker compose build --no-cache app
else
  docker compose build app
fi

echo "Starting services..."
docker compose up -d

echo "Waiting for application healthcheck..."
app_container="$(docker compose ps -q app)"
if [ -z "$app_container" ]; then
  echo "App container was not created."
  exit 1
fi

for _ in $(seq 1 80); do
  health_status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$app_container")"
  if [ "$health_status" = "healthy" ]; then
    echo "Application is healthy."
    echo ""
    docker compose ps
    echo ""
    echo "Database: healthy"
    echo "Application: healthy"
    echo "URL: ${APP_URL}"
    echo "Deployment completed successfully."
    exit 0
  fi

  if [ "$health_status" = "unhealthy" ]; then
    echo "Application healthcheck is unhealthy."
    exit 1
  fi

  sleep 3
done

echo "Application did not become healthy before timeout."
exit 1
