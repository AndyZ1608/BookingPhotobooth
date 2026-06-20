import type { BlockedTime, BusinessSetting, Package, Prisma } from "@prisma/client";

import { calculateDurationMinutes } from "@/lib/money";
import {
  generateSlotTimes,
  generateStartTimes,
  isBlockedByIntervals,
  isInsideBusinessHours,
  isWithinBookingWindow,
} from "@/lib/time";
import { prisma } from "@/lib/prisma";
import { getBusinessSettings } from "@/server/settings";
import { getDefaultResource } from "@/server/resources";

type Db = Prisma.TransactionClient | typeof prisma;

export class AvailabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvailabilityError";
  }
}

type AvailabilityCoreInput = {
  date: string;
  durationMinutes: number;
  settings: BusinessSetting;
  bookedSlotTimes: string[];
  blockedTimes: Pick<BlockedTime, "startTime" | "endTime" | "allDay">[];
  startTime?: string;
};

export function buildAvailableStartTimes(input: AvailabilityCoreInput) {
  const candidates = input.startTime
    ? [input.startTime]
    : generateStartTimes(
        input.settings.openingTime,
        input.settings.closingTime,
        input.settings.slotDurationMinutes,
      );

  const booked = new Set(input.bookedSlotTimes);

  return candidates.filter((candidate) => {
    if (
      !isWithinBookingWindow(input.date, candidate, {
        minimumBookingNoticeMinutes: input.settings.minimumBookingNoticeMinutes,
        maximumBookingDaysAhead: input.settings.maximumBookingDaysAhead,
        timezone: input.settings.timezone,
      })
    ) {
      return false;
    }

    if (
      !isInsideBusinessHours(
        candidate,
        input.durationMinutes,
        input.settings.openingTime,
        input.settings.closingTime,
      )
    ) {
      return false;
    }

    const neededSlots = generateSlotTimes(
      candidate,
      input.durationMinutes,
      input.settings.slotDurationMinutes,
    );

    if (neededSlots.some((slot) => booked.has(slot))) {
      return false;
    }

    return !isBlockedByIntervals(neededSlots, input.blockedTimes);
  });
}

async function loadAvailabilityData(input: {
  db: Db;
  date: string;
  resourceId: string;
  excludeBookingId?: string;
}) {
  const [bookedSlots, blockedTimes] = await Promise.all([
    input.db.bookingSlot.findMany({
      where: {
        resourceId: input.resourceId,
        slotDate: input.date,
        ...(input.excludeBookingId
          ? {
              bookingId: {
                not: input.excludeBookingId,
              },
            }
          : {}),
      },
      select: { slotTime: true },
    }),
    input.db.blockedTime.findMany({
      where: {
        resourceId: input.resourceId,
        date: input.date,
      },
      select: { startTime: true, endTime: true, allDay: true },
    }),
  ]);

  return {
    bookedSlotTimes: bookedSlots.map((slot) => slot.slotTime),
    blockedTimes,
  };
}

export async function getAvailableStartTimes(input: {
  date: string;
  packageId: string;
  quantity: number;
}) {
  const [settings, resource, selectedPackage] = await Promise.all([
    getBusinessSettings(),
    getDefaultResource(),
    prisma.package.findFirst({
      where: { id: input.packageId, isActive: true },
    }),
  ]);

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
  const availabilityData = await loadAvailabilityData({
    db: prisma,
    date: input.date,
    resourceId: resource.id,
  });

  const times = buildAvailableStartTimes({
    date: input.date,
    durationMinutes,
    settings,
    ...availabilityData,
  });

  return {
    times,
    durationMinutes,
    resourceId: resource.id,
    package: selectedPackage,
    settings,
  };
}

export async function assertStartTimeAvailable(input: {
  db: Db;
  date: string;
  startTime: string;
  resourceId: string;
  selectedPackage: Pick<Package, "durationPerShotMinutes">;
  quantity: number;
  settings: BusinessSetting;
  excludeBookingId?: string;
}) {
  const durationMinutes = calculateDurationMinutes(
    input.quantity,
    input.selectedPackage.durationPerShotMinutes,
  );
  const availabilityData = await loadAvailabilityData({
    db: input.db,
    date: input.date,
    resourceId: input.resourceId,
    excludeBookingId: input.excludeBookingId,
  });

  const available = buildAvailableStartTimes({
    date: input.date,
    durationMinutes,
    settings: input.settings,
    startTime: input.startTime,
    ...availabilityData,
  });

  if (!available.includes(input.startTime)) {
    throw new AvailabilityError("Khung giờ này hiện không khả dụng. Vui lòng chọn giờ khác.");
  }
}
