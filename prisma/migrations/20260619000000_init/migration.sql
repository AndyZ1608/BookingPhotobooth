CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "admins" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'STAFF',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "packages" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "durationPerShotMinutes" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resources" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bookings" (
  "id" TEXT NOT NULL,
  "bookingCode" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "packageId" TEXT,
  "packageName" TEXT NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "durationPerShotMinutes" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "totalPrice" INTEGER NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "note" TEXT,
  "internalNote" TEXT,
  "bookingDate" VARCHAR(10) NOT NULL,
  "startTime" VARCHAR(5) NOT NULL,
  "endTime" VARCHAR(5) NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "booking_slots" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "slotDate" VARCHAR(10) NOT NULL,
  "slotTime" VARCHAR(5) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_slots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blocked_times" (
  "id" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "date" VARCHAR(10) NOT NULL,
  "startTime" VARCHAR(5) NOT NULL,
  "endTime" VARCHAR(5) NOT NULL,
  "allDay" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "blocked_times_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_settings" (
  "id" TEXT NOT NULL DEFAULT 'business',
  "openingTime" VARCHAR(5) NOT NULL DEFAULT '09:00',
  "closingTime" VARCHAR(5) NOT NULL DEFAULT '22:00',
  "slotDurationMinutes" INTEGER NOT NULL DEFAULT 10,
  "minimumBookingNoticeMinutes" INTEGER NOT NULL DEFAULT 30,
  "maximumBookingDaysAhead" INTEGER NOT NULL DEFAULT 30,
  "maximumQuantity" INTEGER NOT NULL DEFAULT 10,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_logs" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT,
  "channel" TEXT NOT NULL DEFAULT 'telegram',
  "type" TEXT NOT NULL DEFAULT 'BOOKING_CREATED',
  "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "error" TEXT,
  "payload" JSONB,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "adminId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admins_username_key" ON "admins"("username");
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");
CREATE INDEX "sessions_adminId_idx" ON "sessions"("adminId");
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");
CREATE UNIQUE INDEX "packages_code_key" ON "packages"("code");
CREATE UNIQUE INDEX "bookings_bookingCode_key" ON "bookings"("bookingCode");
CREATE INDEX "bookings_bookingDate_startTime_idx" ON "bookings"("bookingDate", "startTime");
CREATE INDEX "bookings_customerPhone_idx" ON "bookings"("customerPhone");
CREATE INDEX "bookings_status_idx" ON "bookings"("status");
CREATE UNIQUE INDEX "booking_slots_resourceId_slotDate_slotTime_key" ON "booking_slots"("resourceId", "slotDate", "slotTime");
CREATE INDEX "booking_slots_bookingId_idx" ON "booking_slots"("bookingId");
CREATE INDEX "blocked_times_date_idx" ON "blocked_times"("date");
CREATE INDEX "notification_logs_bookingId_idx" ON "notification_logs"("bookingId");
CREATE INDEX "notification_logs_status_idx" ON "notification_logs"("status");
CREATE INDEX "audit_logs_adminId_idx" ON "audit_logs"("adminId");
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking_slots" ADD CONSTRAINT "booking_slots_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_slots" ADD CONSTRAINT "booking_slots_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blocked_times" ADD CONSTRAINT "blocked_times_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
