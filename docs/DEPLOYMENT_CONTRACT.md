# Deployment Contract

This repository must remain deployable with only Git, Docker Engine, and the Docker Compose plugin installed on the host.

Standard update command:

```bash
git pull --ff-only
./scripts/deploy.sh
```

No production operator should need to install Node.js, npm, pnpm, Prisma CLI, PostgreSQL client tools, Python, or any application dependency on the host.

## Toolchain Contract

- Docker base image must stay on Debian Bookworm Slim or another explicitly reviewed Debian-based image.
- Corepack version is pinned in `Dockerfile` and must be installed before pnpm.
- pnpm version is pinned in `Dockerfile` and must match `packageManager` in `package.json`.
- Do not rely on the Corepack version bundled in the Node image.
- Do not disable Corepack signature verification.
- Do not download package managers at container runtime.
- Do not run `corepack prepare`, `corepack install`, `npm install`, `pnpm install`, or dependency installation in `scripts/docker-entrypoint.sh`.
- Toolchain changes must be verified by Docker build and runtime tool checks.

Required versions:

- Corepack: `0.35.0`
- pnpm: `10.23.0`

## Admin Auth Contract

- Admin sessions use opaque database tokens.
- The raw session token may exist only in the HTTP-only cookie.
- The database stores only an HMAC/hash of the session token.
- Cookie `secure` is controlled only by `SESSION_COOKIE_SECURE`.
- Do not derive cookie `secure` from `NODE_ENV`.
- Do not set a cookie `domain` unless a multi-subdomain requirement is explicitly added.
- Auth must not depend on a hard-coded IP, hostname, production domain, or `NEXT_PUBLIC_APP_URL`.
- HTTP deployments must use `SESSION_COOKIE_SECURE="false"`.
- HTTPS deployments must use `SESSION_COOKIE_SECURE="true"`.
- Runtime Prisma Client must support `require("@prisma/client")` in the app container.

## Synchronized Changes

When source code or features change, update the deployment surface in the same change set.

If adding a dependency, update:

- `package.json`
- `pnpm-lock.yaml`
- Docker build flow

If changing the database, update:

- `prisma/schema.prisma`
- `prisma/migrations/`
- seed script if needed
- tests or release notes for migration safety

If adding an environment variable, update:

- source validation
- `.env.example`
- `docker-compose.yml` if the variable is required by a service
- `README.md`

Secrets must not be declared in `Dockerfile` as `ARG` or `ENV`. Runtime secrets are injected only by Docker Compose from `.env` interpolation.

If adding a service, update:

- `docker-compose.yml`
- healthcheck
- `depends_on`
- network and volume definitions if needed
- deploy script
- `README.md`

If changing how the app starts, update:

- `Dockerfile`
- `scripts/docker-entrypoint.sh`
- healthcheck
- deploy script
- `README.md`

Do not hand off source changes unless Docker deployment has been kept in sync.

## Production Migration Rules

Production only runs the equivalent of:

```bash
prisma migrate deploy
```

Production must never run:

- `prisma migrate dev`
- `prisma db push`
- `prisma migrate reset`
- `docker compose down -v` during updates

Migrations must be safe for existing data. When a breaking schema change is needed, deploy it in multiple releases:

1. Add the new schema in a backward-compatible way.
2. Deploy code that supports old and new data.
3. Backfill data.
4. Verify.
5. Remove old schema only in a later release.

## Seed Rules

Seed scripts must be idempotent and production-safe:

- create missing admin/package/resource/settings only when absent
- never overwrite existing admin passwords
- never reset business settings
- never overwrite admin-edited packages
- never delete bookings or operational data
- never use `deleteMany`, truncate, reset, or destructive cleanup

## Required Release Checks

Every release must validate two scenarios.

Fresh install, in a disposable test environment only:

```bash
docker compose down -v
docker compose up -d --build
```

Verify database creation, migrations, seed, and app health.

Existing installation:

```bash
git pull --ff-only
./scripts/deploy.sh
```

Verify old bookings remain, existing admin password remains unchanged, settings are not reset, migrations only apply pending files, no duplicate seed data is created, and app health is green.

## Rollback Policy

Deployment scripts must not delete volumes or reset the database. If an app deployment fails, roll back code to a known-good revision and rerun `./scripts/deploy.sh`.

Database rollback must be planned manually. Do not run `prisma migrate reset` or `docker compose down -v` as an application rollback.
