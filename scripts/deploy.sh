#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NO_CACHE=false
BUILD_PULL=true
APP_SERVICE="app"
DB_SERVICE="db"
APP_PORT_VALUE="3000"
APP_BIND_VALUE="127.0.0.1"

if [ "${1:-}" = "--no-cache" ]; then
  NO_CACHE=true
elif [ "${1:-}" != "" ]; then
  echo "Usage: ./scripts/deploy.sh [--no-cache]"
  exit 1
fi

print_container_state() {
  local service="$1"
  local id

  id="$(docker compose ps -q "$service")"
  if [ -z "$id" ]; then
    echo "${service}: container not found"
    return 0
  fi

  local status health
  status="$(docker inspect --format '{{.State.Status}}' "$id" 2>/dev/null || printf 'unknown')"
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id" 2>/dev/null || printf 'unknown')"

  echo "${service}: status=${status}, health=${health}, id=${id}"
}

print_diagnostics() {
  set +e
  echo ""
  echo "Diagnostics:"
  echo "Docker Compose services:"
  docker compose ps -a
  echo ""
  print_container_state "$DB_SERVICE"
  print_container_state "$APP_SERVICE"
  echo ""
  echo "App health details:"
  app_id="$(docker compose ps -q "$APP_SERVICE")"
  if [ -n "$app_id" ]; then
    docker inspect --format '{{json .State.Health}}' "$app_id"
  fi
  echo ""
  echo "Recent app logs:"
  docker compose logs --tail=220 "$APP_SERVICE"
  echo ""
  echo "Recent database logs:"
  docker compose logs --tail=160 "$DB_SERVICE"
  echo ""
  echo "Disk usage:"
  df -h .
  echo ""
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Git commit: $(git rev-parse --short HEAD)"
  fi
  set -e
}

handle_error() {
  local exit_code="$1"
  local line="$2"
  local command="$3"

  set +e
  echo ""
  echo "Deployment failed."
  echo "Exit code: ${exit_code}"
  echo "Line: ${line}"
  echo "Command: ${command}"
  print_diagnostics
  echo "Rollback guidance: checkout a known-good code revision and rerun ./scripts/deploy.sh."
  echo "Database volumes are preserved. Do not delete Docker volumes during application rollback."
  exit "$exit_code"
}

trap 'handle_error "$?" "$LINENO" "$BASH_COMMAND"' ERR

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

read_env_value() {
  local name="$1"
  local line value

  line="$(
    awk -v key="$name" '
      $0 ~ "^[[:space:]]*" key "=" {
        value = $0
      }
      END {
        print value
      }
    ' .env
  )"

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

container_id() {
  docker compose ps -q "$1"
}

container_status() {
  docker inspect --format '{{.State.Status}}' "$1"
}

container_health() {
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$1"
}

wait_for_healthy_service() {
  local service="$1"
  local timeout_seconds="${2:-180}"
  local started_at now elapsed id status health

  id="$(container_id "$service")"
  if [ -z "$id" ]; then
    echo "${service} container was not created."
    exit 1
  fi

  started_at="$(date +%s)"
  while true; do
    status="$(container_status "$id")"
    health="$(container_health "$id")"

    if [ "$status" = "running" ] && [ "$health" = "healthy" ]; then
      echo "${service} is running and healthy."
      return 0
    fi

    if [ "$status" = "running" ] && [ "$health" = "none" ]; then
      echo "${service} has no Docker healthcheck configured."
      exit 1
    fi

    if [ "$status" = "exited" ] || [ "$status" = "dead" ] || [ "$status" = "restarting" ]; then
      echo "${service} container is ${status}."
      exit 1
    fi

    if [ "$health" = "unhealthy" ]; then
      echo "${service} healthcheck is unhealthy."
      exit 1
    fi

    now="$(date +%s)"
    elapsed=$((now - started_at))
    if [ "$elapsed" -ge "$timeout_seconds" ]; then
      echo "${service} did not become healthy within ${timeout_seconds}s. Last status=${status}, health=${health}."
      exit 1
    fi

    sleep 3
  done
}

verify_http_health() {
  local url="http://127.0.0.1:${APP_PORT_VALUE}/api/health"

  echo "Verifying HTTP health: ${url}"
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS "$url" >/dev/null; then
      echo "Application health endpoint is healthy."
      return 0
    fi

    echo "Application health endpoint did not return HTTP 200."
    exit 1
  fi

  echo "curl is not available on host; verifying HTTP health inside app container."
  if docker compose exec -T "$APP_SERVICE" node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    echo "Application health endpoint is healthy."
    return 0
  fi

  echo "Application health endpoint did not return HTTP 200."
  exit 1
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

app_bind="$(read_env_value APP_BIND_ADDRESS)"
app_port="$(read_env_value APP_PORT)"
APP_BIND_VALUE="${app_bind:-127.0.0.1}"
APP_PORT_VALUE="${app_port:-3000}"

if [ "$APP_BIND_VALUE" != "127.0.0.1" ] && [ "$APP_BIND_VALUE" != "localhost" ]; then
  echo "APP_BIND_ADDRESS should normally be 127.0.0.1 behind host Nginx. Current value is not printed for safety."
  echo "Set APP_BIND_ADDRESS=127.0.0.1 unless you intentionally reviewed a different bind address."
  exit 1
fi

if ! [[ "$APP_PORT_VALUE" =~ ^[0-9]+$ ]]; then
  echo "APP_PORT must be a numeric TCP port."
  exit 1
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  export APP_IMAGE_TAG="$(git rev-parse --short HEAD)"
else
  export APP_IMAGE_TAG="local"
fi

echo "Validating Docker Compose configuration..."
docker compose config >/dev/null

echo "Building Docker image..."
if [ "$NO_CACHE" = "true" ]; then
  if ! docker compose build --pull --no-cache "$APP_SERVICE"; then
    echo "Docker image pull/build failed."
    exit 1
  fi
else
  if [ "$BUILD_PULL" = "true" ]; then
    if ! docker compose build --pull "$APP_SERVICE"; then
      echo "Docker image pull/build failed."
      exit 1
    fi
  else
    if ! docker compose build "$APP_SERVICE"; then
      echo "Docker image build failed."
      exit 1
    fi
  fi
fi

echo "Starting services..."
docker compose up -d --remove-orphans

echo "Waiting for database health..."
wait_for_healthy_service "$DB_SERVICE" 180

echo "Waiting for application health..."
wait_for_healthy_service "$APP_SERVICE" 180

verify_http_health

echo ""
docker compose ps
echo ""
echo "Database: healthy"
echo "Application: healthy"
echo "HTTP health: 200"
echo "Application: http://127.0.0.1:${APP_PORT_VALUE}"
echo "Deployment completed successfully."
