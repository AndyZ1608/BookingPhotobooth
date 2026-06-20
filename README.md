# Photobooth Booking MVP

Production-ready MVP cho hệ thống đặt lịch cửa hàng photobooth: public booking page, admin dashboard, PostgreSQL/Prisma, session auth, chống double booking bằng `booking_slots` unique constraint và Telegram notification.

## Yêu cầu môi trường

- Node.js 24 hoặc mới hơn.
- pnpm 10.
- PostgreSQL 16.
- Docker và Docker Compose nếu chạy bằng container.

## Cấu hình `.env`

Sao chép `.env.example` thành `.env` và đổi các giá trị:

```bash
DATABASE_URL="postgresql://photobooth:photobooth@localhost:5432/booking_photobooth?schema=public"
SESSION_SECRET="random-string-it-nhat-32-ky-tu"
ADMIN_USERNAME="admin"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="mat-khau-manh-it-nhat-12-ky-tu"
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
```

Không commit `.env`. `ADMIN_PASSWORD` chỉ dùng để seed, app lưu bcrypt hash.

## Chạy local

```bash
pnpm install
pnpm env:check
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Sau lần install đầu tiên, commit `pnpm-lock.yaml` để build production tái lập được.

Public page: [http://localhost:3000](http://localhost:3000)

Admin: [http://localhost:3000/admin](http://localhost:3000/admin)

## Chạy Docker Compose

```bash
docker compose up --build
```

Compose sẽ khởi động PostgreSQL, chạy migration, seed dữ liệu và start Next.js.

## Migration và seed

```bash
pnpm db:migrate
pnpm db:seed
```

Production:

```bash
pnpm db:deploy
pnpm db:seed
```

## Telegram Bot

1. Mở Telegram, chat với `@BotFather`.
2. Tạo bot bằng `/newbot`.
3. Copy token vào `TELEGRAM_BOT_TOKEN`.
4. Gửi một tin nhắn tới bot hoặc thêm bot vào group.
5. Mở `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates`.
6. Lấy `chat.id` và đưa vào `TELEGRAM_CHAT_ID`.

Nếu Telegram lỗi, booking vẫn được commit và lỗi được ghi vào `notification_logs`.

## Backup PostgreSQL

```bash
docker compose exec db pg_dump -U photobooth booking_photobooth > backup.sql
```

Restore:

```bash
docker compose exec -T db psql -U photobooth booking_photobooth < backup.sql
```

## Triển khai sau Nginx HTTPS

- Chạy app ở `127.0.0.1:3000`.
- Terminate TLS tại Nginx.
- Forward các header:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

Khi chạy production sau HTTPS, cookie session sẽ được set `Secure`.

## Kiểm tra

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm build
pnpm exec prisma validate
pnpm exec prisma generate
```

Integration tests đụng DB chỉ nên chạy trên database test riêng.
