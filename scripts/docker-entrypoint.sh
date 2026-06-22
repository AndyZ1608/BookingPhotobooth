#!/usr/bin/env sh
set -eu

log() {
  printf '%s\n' "$1"
}

require_env() {
  name="$1"
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    log "Missing required environment variable: $name"
    exit 1
  fi
}

validate_runtime_env() {
  require_env DATABASE_URL
  require_env SESSION_SECRET

  if [ "${RUN_DB_SEED:-false}" = "true" ]; then
    require_env ADMIN_USERNAME
    require_env ADMIN_EMAIL
    require_env ADMIN_PASSWORD
  fi
}

wait_for_database() {
  log "Waiting for database..."
  attempt=1
  max_attempts="${DB_WAIT_MAX_ATTEMPTS:-60}"

  while [ "$attempt" -le "$max_attempts" ]; do
    if node - <<'NODE'
const { PrismaClient } = require("./src/generated/prisma");
const prisma = new PrismaClient();

prisma
  .$queryRawUnsafe("SELECT 1")
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async () => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
NODE
    then
      log "Database is reachable."
      return 0
    fi

    attempt=$((attempt + 1))
    sleep 2
  done

  log "Database did not become reachable in time."
  exit 1
}

validate_runtime_env
wait_for_database

log "Applying database migrations..."
pnpm prisma migrate deploy

if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  log "Running idempotent database seed..."
  pnpm db:seed
else
  log "Database seed disabled."
fi

log "Starting application..."
exec node server.js
