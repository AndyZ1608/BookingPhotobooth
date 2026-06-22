import type { Admin, Package, Resource } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { getAvailableStartTimes } from "@/server/availability";
import { createPublicBooking, updateBookingStatus } from "@/server/bookings";

const shouldRunDbTests =
  process.env.RUN_DB_TESTS === "true" && (process.env.DATABASE_URL ?? "").includes("test");
const describeDb = shouldRunDbTests ? describe : describe.skip;

function futureDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + 2 * 86_400_000));
}

async function resetDb() {
  await prisma.notificationLog.deleteMany();
  await prisma.bookingSlot.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.blockedTime.deleteMany();
  await prisma.session.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.package.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.businessSetting.deleteMany();
}

async function seedTestData(): Promise<{ admin: Admin; pack: Package; resource: Resource }> {
  const [admin, pack, resource] = await Promise.all([
    prisma.admin.create({
      data: {
        username: "test-admin",
        email: "test-admin@example.com",
        passwordHash: await bcrypt.hash("test-password-123", 4),
        role: "ADMIN",
      },
    }),
    prisma.package.create({
      data: {
        code: "BASIC",
        name: "Gói tiêu chuẩn",
        durationPerShotMinutes: 10,
        isActive: true,
      },
    }),
    prisma.resource.create({
      data: { name: "Photobooth test", isActive: true },
    }),
  ]);

  await prisma.businessSetting.create({
    data: {
      id: "business",
      openingTime: "09:00",
      closingTime: "22:00",
      slotDurationMinutes: 10,
      minimumBookingNoticeMinutes: 0,
      maximumBookingDaysAhead: 30,
      maximumQuantity: 10,
      timezone: "Asia/Ho_Chi_Minh",
    },
  });

  return { admin, pack, resource };
}

describeDb("booking integration", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("không đặt slot đã có booking", async () => {
    const { pack } = await seedTestData();
    const date = futureDate();

    await createPublicBooking({
      date,
      startTime: "10:00",
      packageId: pack.id,
      quantity: 1,
      customerName: "Khách A",
      customerPhone: "0900000001",
    });

    await expect(
      createPublicBooking({
        date,
        startTime: "10:00",
        packageId: pack.id,
        quantity: 1,
        customerName: "Khách B",
        customerPhone: "0900000002",
      }),
    ).rejects.toThrow();

    await expect(prisma.booking.count()).resolves.toBe(1);
  });

  it("hai request đồng thời không tạo double booking", async () => {
    const { pack } = await seedTestData();
    const date = futureDate();

    const requests = await Promise.allSettled([
      createPublicBooking({
        date,
        startTime: "10:00",
        packageId: pack.id,
        quantity: 1,
        customerName: "Khách A",
        customerPhone: "0900000001",
      }),
      createPublicBooking({
        date,
        startTime: "10:00",
        packageId: pack.id,
        quantity: 1,
        customerName: "Khách B",
        customerPhone: "0900000002",
      }),
    ]);

    expect(requests.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(requests.filter((item) => item.status === "rejected")).toHaveLength(1);
    expect(await prisma.booking.count()).toBe(1);
    expect(await prisma.bookingSlot.count()).toBe(1);
  });

  it("không đặt slot bị block", async () => {
    const { pack, resource } = await seedTestData();
    const date = futureDate();
    await prisma.blockedTime.create({
      data: {
        resourceId: resource.id,
        date,
        startTime: "10:00",
        endTime: "10:30",
        reason: "Bảo trì",
      },
    });

    await expect(
      createPublicBooking({
        date,
        startTime: "10:00",
        packageId: pack.id,
        quantity: 1,
        customerName: "Khách A",
        customerPhone: "0900000001",
      }),
    ).rejects.toThrow();
  });

  it("cancel booking giải phóng slot", async () => {
    const { admin, pack } = await seedTestData();
    const date = futureDate();
    const booking = await createPublicBooking({
      date,
      startTime: "10:00",
      packageId: pack.id,
      quantity: 1,
      customerName: "Khách A",
      customerPhone: "0900000001",
    });

    await updateBookingStatus({ id: booking.id, adminId: admin.id, status: "CANCELLED" });

    const availability = await getAvailableStartTimes({ date, packageId: pack.id, quantity: 1 });
    expect(availability.times).toContain("10:00");
    expect(await prisma.bookingSlot.count()).toBe(0);
  });

  it("Telegram lỗi không rollback booking", async () => {
    const { pack } = await seedTestData();
    const date = futureDate();
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "chat");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("telegram down")));

    await createPublicBooking({
      date,
      startTime: "10:00",
      packageId: pack.id,
      quantity: 1,
      customerName: "Khách A",
      customerPhone: "0900000001",
    });

    expect(await prisma.booking.count()).toBe(1);
    expect(await prisma.notificationLog.count({ where: { status: "FAILED" } })).toBe(1);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("booking giữ snapshot tên gói sau khi package được chỉnh sửa", async () => {
    const { pack } = await seedTestData();
    const date = futureDate();
    const booking = await createPublicBooking({
      date,
      startTime: "10:00",
      packageId: pack.id,
      quantity: 2,
      customerName: "Khách A",
      customerPhone: "0900000001",
    });

    await prisma.package.update({ where: { id: pack.id }, data: { name: "Gói mới" } });
    const persisted = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });

    expect(persisted.packageName).toBe("Gói tiêu chuẩn");
  });
});
