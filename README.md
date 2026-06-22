# Photobooth Booking

Hệ thống đặt lịch photobooth gồm public booking page, admin dashboard, PostgreSQL/Prisma, session auth, chống double booking bằng unique constraint ở `booking_slots`, và Telegram notification sau khi booking commit.

## Deployment Contract

Host production chỉ cần:

- Git
- Docker Engine
- Docker Compose Plugin

Host production không cần Node.js, npm, pnpm, Prisma CLI, PostgreSQL client, Python, hay lệnh build thủ công.

Lệnh cập nhật chuẩn từ nay:

```bash
git pull --ff-only
./scripts/deploy.sh
```

Hoặc:

```bash
./scripts/update.sh
```

## Cài lần đầu

```bash
git clone <repository-url> BookingPhotobooth
cd BookingPhotobooth
cp .env.example .env
nano .env
./scripts/deploy.sh
```

Các biến bắt buộc trong `.env`:

```bash
DATABASE_URL="postgresql://photobooth:photobooth@db:5432/booking_photobooth?schema=public"
SESSION_SECRET="random-string-it-nhat-32-ky-tu"
SESSION_COOKIE_SECURE="false"
ADMIN_SESSION_TTL_HOURS="12"
RUN_DB_SEED="true"
APP_PORT="3000"

ADMIN_USERNAME="admin"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="mat-khau-manh-it-nhat-12-ky-tu"

TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

`DATABASE_URL`, `SESSION_SECRET`, `ADMIN_PASSWORD`, `TELEGRAM_BOT_TOKEN` là server-only. Không commit `.env`.

## Update các lần sau

```bash
cd ~/BookingPhotobooth
git pull --ff-only
./scripts/deploy.sh
```

Hoặc:

```bash
cd ~/BookingPhotobooth
./scripts/update.sh
```

`scripts/update.sh` sẽ dừng nếu working tree có thay đổi local. Script không force reset, không xóa file, không ghi đè `.env`.

## Docker workflow

`./scripts/deploy.sh` tự động:

- validate Docker, Docker Compose và `.env`
- chạy `docker compose config`
- build image
- cài `corepack@0.35.0` trong image
- cài `pnpm@10.23.0` qua Corepack trong image
- cài dependency trong image bằng `pnpm install --frozen-lockfile`
- generate Prisma Client trong image
- chờ PostgreSQL healthy
- chạy `prisma migrate deploy`
- chạy seed idempotent nếu `RUN_DB_SEED=true`
- start Next.js production server bằng `node server.js`
- chờ app healthcheck

Không chạy thủ công trên host:

```bash
pnpm install
pnpm build
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm start
```

Không có bước tải pnpm ở container runtime. Runtime chỉ chạy migration, seed idempotent nếu bật, rồi start `node server.js`.

## Kiểm tra vận hành

```bash
docker compose ps
curl http://localhost:3000/api/health
docker compose logs -f app
docker compose logs -f db
docker compose restart app
```

Health endpoint thành công:

```json
{
  "status": "ok",
  "database": "connected"
}
```

Nếu database lỗi, endpoint trả HTTP 503 và không lộ secret.

## Release check

Chạy trước khi bàn giao release:

```bash
./scripts/release-check.sh
```

Script chạy lint, type-check, test, Prisma validate/generate, Next.js production build, Docker Compose config, và Docker image build bên trong Docker. Host vẫn không cần pnpm.

Release check cũng xác minh:

- Corepack: `0.35.0`
- pnpm: `10.23.0`
- OpenSSL: available
- Prisma Client: `require("@prisma/client")` load được trong runtime image

## Migration và dữ liệu

Production chỉ chạy tương đương:

```bash
prisma migrate deploy
```

Không dùng trong production:

```bash
prisma migrate dev
prisma db push
prisma migrate reset
docker compose down -v
```

`docker compose down` sẽ dừng container nhưng giữ named volume database.

`docker compose down -v` xóa database volume và làm mất dữ liệu. Không dùng lệnh này khi update production.

## Seed

Seed script idempotent:

- chỉ tạo admin mặc định nếu chưa có admin cùng username/email
- không đổi password admin hiện có
- chỉ tạo package mặc định nếu code chưa tồn tại
- không ghi đè package admin đã chỉnh
- chỉ tạo business setting nếu chưa tồn tại
- không xóa booking hoặc dữ liệu production

## Telegram

Ứng dụng chỉ gọi Telegram Bot API `sendMessage` khi có booking mới. Không long polling và không cạnh tranh bot receiver.

Nếu Telegram lỗi:

1. Booking vẫn đã được commit.
2. Lỗi được ghi vào `notification_logs`.
3. API public vẫn trả booking thành công.

## Backup PostgreSQL

```bash
docker compose exec db pg_dump -U photobooth booking_photobooth > backup.sql
```

Restore:

```bash
docker compose exec -T db psql -U photobooth booking_photobooth < backup.sql
```

## Nginx HTTPS

Chạy app sau reverse proxy:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

Cookie admin không phụ thuộc hostname/IP và không dùng cookie domain. Với HTTP nội bộ hoặc test qua IP, đặt `SESSION_COOKIE_SECURE="false"`. Khi chạy sau Nginx HTTPS, đặt `SESSION_COOKIE_SECURE="true"` trong `.env`.

## Chi tiết contract

Xem [docs/DEPLOYMENT_CONTRACT.md](docs/DEPLOYMENT_CONTRACT.md).
