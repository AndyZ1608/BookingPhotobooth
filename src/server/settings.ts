import type { BusinessSetting, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const DEFAULT_SETTINGS = {
  id: "business",
  openingTime: "09:00",
  closingTime: "22:00",
  slotDurationMinutes: 10,
  minimumBookingNoticeMinutes: 30,
  maximumBookingDaysAhead: 30,
  maximumQuantity: 10,
  timezone: "Asia/Ho_Chi_Minh",
  currency: "VND",
};

type Db = Prisma.TransactionClient | typeof prisma;

export async function getBusinessSettings(db: Db = prisma): Promise<BusinessSetting> {
  return db.businessSetting.upsert({
    where: { id: "business" },
    update: {},
    create: DEFAULT_SETTINGS,
  });
}

export async function updateBusinessSettings(
  data: Omit<typeof DEFAULT_SETTINGS, "id">,
  db: Db = prisma,
) {
  return db.businessSetting.upsert({
    where: { id: "business" },
    update: data,
    create: {
      ...DEFAULT_SETTINGS,
      ...data,
    },
  });
}
