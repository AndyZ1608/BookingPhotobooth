UPDATE "packages"
SET "name" = 'Gói tiêu chuẩn'
WHERE "code" = 'BASIC'
  AND "name" IN ('Gói 80K', 'Gói 80k', 'BASIC 80K', 'BASIC 80k');

UPDATE "packages"
SET "name" = 'Gói mở rộng'
WHERE "code" = 'PREMIUM'
  AND "name" IN ('Gói 120K', 'Gói 120k', 'PREMIUM 120K', 'PREMIUM 120k');

ALTER TABLE "packages" DROP COLUMN IF EXISTS "unitPrice";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "unitPrice";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "totalPrice";
ALTER TABLE "business_settings" DROP COLUMN IF EXISTS "currency";
