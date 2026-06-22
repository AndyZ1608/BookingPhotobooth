import type { BookingStatus, Prisma } from "@/generated/prisma";

import { SLOT_CONFLICT_MESSAGE } from "@/lib/constants";
import { calculateDurationMinutes, calculateTotalPrice } from "@/lib/money";
import { addMinutesToTime, generateSlotTimes } from "@/lib/time";
import { normalizePhone } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { assertStartTimeAvailable, AvailabilityError } from "@/server/availability";
import { getBusinessSettings } from "@/server/settings";
import { notifyBookingCreated } from "@/server/telegram";
import { writeAuditLog } from "@/server/audit";

export class SlotConflictError extends Error {
  constructor(message = SLOT_CONFLICT_MESSAGE) {
    super(message);
    this.name = "SlotConflictError";
  }
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function getUniqueTargets(error: unknown) {
  if (
    typeof error !== "object" ||
    error === null ||
    !("meta" in error) ||
    typeof error.meta !== "object" ||
    error.meta === null ||
    !("target" in error.meta)
  ) {
    return [];
  }

  const target = error.meta.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === "string") return [target];
  return [];
}

function isBookingCodeConflict(error: unknown) {
  return getUniqueTargets(error).some((target) => target.includes("bookingCode"));
}

function makeBookingCode(date: string, sequence: number) {
  return `PB-${date.replaceAll("-", "")}-${sequence.toString().padStart(4, "0")}`;
}

async function createBookingInTransaction(input: {
  date: string;
  startTime: string;
  packageId: string;
  quantity: number;
  customerName: string;
  customerPhone: string;
  note?: string;
}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const [settings, resource, selectedPackage] = await Promise.all([
          getBusinessSettings(tx),
          tx.resource.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: "asc" },
          }),
          tx.package.findFirst({
            where: { id: input.packageId, isActive: true },
          }),
        ]);

        if (!resource) {
          throw new Error("Chưa có resource photobooth hoạt động. Vui lòng chạy seed dữ liệu.");
        }

        if (!selectedPackage) {
          throw new AvailabilityError("Gói chụp không tồn tại hoặc đã ngừng bán.");
        }

        if (input.quantity > settings.maximumQuantity) {
          throw new AvailabilityError(`Số lần chụp tối đa là ${settings.maximumQuantity}.`);
        }

        const durationMinutes = calculateDurationMinutes(
          input.quantity,
          selectedPackage.durationPerShotMinutes,
        );
        const totalPrice = calculateTotalPrice(input.quantity, selectedPackage.unitPrice);
        const endTime = addMinutesToTime(input.startTime, durationMinutes);
        const slotTimes = generateSlotTimes(
          input.startTime,
          durationMinutes,
          settings.slotDurationMinutes,
        );

        await assertStartTimeAvailable({
          db: tx,
          date: input.date,
          startTime: input.startTime,
          resourceId: resource.id,
          selectedPackage,
          quantity: input.quantity,
          settings,
        });

        const dailyCount = await tx.booking.count({
          where: { bookingDate: input.date },
        });
        const bookingCode = makeBookingCode(input.date, dailyCount + 1 + attempt);

        const booking = await tx.booking.create({
          data: {
            bookingCode,
            resourceId: resource.id,
            packageId: selectedPackage.id,
            packageName: selectedPackage.name,
            unitPrice: selectedPackage.unitPrice,
            durationPerShotMinutes: selectedPackage.durationPerShotMinutes,
            quantity: input.quantity,
            totalPrice,
            customerName: input.customerName.trim(),
            customerPhone: normalizePhone(input.customerPhone),
            note: input.note?.trim() || null,
            bookingDate: input.date,
            startTime: input.startTime,
            endTime,
            slots: {
              create: slotTimes.map((slotTime) => ({
                resourceId: resource.id,
                slotDate: input.date,
                slotTime,
              })),
            },
          },
          include: { slots: true },
        });

        return booking;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        if (isBookingCodeConflict(error)) {
          continue;
        }
        throw new SlotConflictError();
      }
      throw error;
    }
  }

  throw new Error("Không thể tạo mã đặt lịch duy nhất. Vui lòng thử lại.");
}

export async function createPublicBooking(input: {
  date: string;
  startTime: string;
  packageId: string;
  quantity: number;
  customerName: string;
  customerPhone: string;
  note?: string;
}) {
  const booking = await createBookingInTransaction(input);
  await notifyBookingCreated(booking);
  return booking;
}

export async function listBookings(input: {
  date?: string;
  from?: string;
  to?: string;
  status?: BookingStatus;
  packageId?: string;
  search?: string;
}) {
  const where: Prisma.BookingWhereInput = {};

  if (input.date) {
    where.bookingDate = input.date;
  } else if (input.from || input.to) {
    where.bookingDate = {
      ...(input.from ? { gte: input.from } : {}),
      ...(input.to ? { lte: input.to } : {}),
    };
  }

  if (input.status) where.status = input.status;
  if (input.packageId) where.packageId = input.packageId;

  if (input.search?.trim()) {
    const search = input.search.trim();
    where.OR = [
      { bookingCode: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
      { customerPhone: { contains: normalizePhone(search), mode: "insensitive" } },
    ];
  }

  return prisma.booking.findMany({
    where,
    orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
    include: { slots: true },
    take: 300,
  });
}

export async function getBookingById(id: string) {
  return prisma.booking.findUnique({
    where: { id },
    include: { slots: true, notificationLogs: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
}

export async function updateBooking(input: {
  id: string;
  adminId: string;
  ipAddress?: string;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  internalNote?: string;
  date?: string;
  startTime?: string;
}) {
  try {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: input.id },
      });

      if (!booking) {
        throw new Error("Không tìm thấy booking.");
      }

      if (booking.status === "CANCELLED") {
        throw new Error("Booking đã hủy không thể chỉnh sửa.");
      }

      const nextDate = input.date ?? booking.bookingDate;
      const nextStartTime = input.startTime ?? booking.startTime;
      const moving = nextDate !== booking.bookingDate || nextStartTime !== booking.startTime;
      const settings = await getBusinessSettings(tx);
      const durationMinutes = calculateDurationMinutes(
        booking.quantity,
        booking.durationPerShotMinutes,
      );
      const nextEndTime = addMinutesToTime(nextStartTime, durationMinutes);

      if (moving) {
        await assertStartTimeAvailable({
          db: tx,
          date: nextDate,
          startTime: nextStartTime,
          resourceId: booking.resourceId,
          selectedPackage: {
            durationPerShotMinutes: booking.durationPerShotMinutes,
          },
          quantity: booking.quantity,
          settings,
          excludeBookingId: booking.id,
        });
      }

      const updated = await tx.booking.update({
        where: { id: input.id },
        data: {
          ...(input.customerName !== undefined ? { customerName: input.customerName.trim() } : {}),
          ...(input.customerPhone !== undefined
            ? { customerPhone: normalizePhone(input.customerPhone) }
            : {}),
          ...(input.note !== undefined ? { note: input.note.trim() || null } : {}),
          ...(input.internalNote !== undefined
            ? { internalNote: input.internalNote.trim() || null }
            : {}),
          ...(moving
            ? {
                bookingDate: nextDate,
                startTime: nextStartTime,
                endTime: nextEndTime,
              }
            : {}),
        },
        include: { slots: true },
      });

      if (moving) {
        const slotTimes = generateSlotTimes(
          nextStartTime,
          durationMinutes,
          settings.slotDurationMinutes,
        );
        await tx.bookingSlot.deleteMany({ where: { bookingId: booking.id } });
        await tx.bookingSlot.createMany({
          data: slotTimes.map((slotTime) => ({
            bookingId: booking.id,
            resourceId: booking.resourceId,
            slotDate: nextDate,
            slotTime,
          })),
        });
      }

      await writeAuditLog(
        {
          adminId: input.adminId,
          action: moving ? "BOOKING_RESCHEDULED" : "BOOKING_UPDATED",
          entityType: "Booking",
          entityId: booking.id,
          metadata: {
            before: {
              bookingDate: booking.bookingDate,
              startTime: booking.startTime,
              customerName: booking.customerName,
              customerPhone: booking.customerPhone,
            },
            after: {
              bookingDate: nextDate,
              startTime: nextStartTime,
              customerName: updated.customerName,
              customerPhone: updated.customerPhone,
            },
          },
          ipAddress: input.ipAddress,
        },
        tx,
      );

      return tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: { slots: true },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new SlotConflictError();
    }
    throw error;
  }
}

const ALLOWED_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export async function updateBookingStatus(input: {
  id: string;
  adminId: string;
  status: BookingStatus;
  ipAddress?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: input.id } });
    if (!booking) throw new Error("Không tìm thấy booking.");
    if (booking.status === input.status) return booking;

    const allowed = ALLOWED_STATUS_TRANSITIONS[booking.status].includes(input.status);
    if (!allowed) {
      throw new Error("Trạng thái chuyển đổi không hợp lệ.");
    }

    const updated = await tx.booking.update({
      where: { id: input.id },
      data: {
        status: input.status,
        ...(input.status === "CANCELLED" ? { cancelledAt: new Date() } : {}),
      },
    });

    if (input.status === "CANCELLED") {
      await tx.bookingSlot.deleteMany({ where: { bookingId: booking.id } });
    }

    await writeAuditLog(
      {
        adminId: input.adminId,
        action: input.status === "CANCELLED" ? "BOOKING_CANCELLED" : "BOOKING_STATUS_CHANGED",
        entityType: "Booking",
        entityId: booking.id,
        metadata: { before: booking.status, after: input.status },
        ipAddress: input.ipAddress,
      },
      tx,
    );

    return updated;
  });
}
