import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_PACKAGES = [
  {
    code: "BASIC",
    name: "Gói tiêu chuẩn",
    durationPerShotMinutes: 10,
    sortOrder: 1,
  },
  {
    code: "PREMIUM",
    name: "Gói mở rộng",
    durationPerShotMinutes: 10,
    sortOrder: 2,
  },
];

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for seed.`);
  }
  return value;
}

async function seedPackages() {
  for (const item of DEFAULT_PACKAGES) {
    const existing = await prisma.package.findUnique({
      where: { code: item.code },
    });

    if (!existing) {
      await prisma.package.create({
        data: {
          ...item,
          isActive: true,
        },
      });
    }
  }
}

async function seedResource() {
  const existing = await prisma.resource.findFirst({
    where: { name: "Photobooth chính" },
  });

  if (existing) {
    return;
  }

  await prisma.resource.create({
    data: {
      name: "Photobooth chính",
      isActive: true,
    },
  });
}

async function seedSettings() {
  const existing = await prisma.businessSetting.findUnique({
    where: { id: "business" },
  });

  if (!existing) {
    await prisma.businessSetting.create({
      data: {
        id: "business",
        openingTime: "09:00",
        closingTime: "22:00",
        slotDurationMinutes: 10,
        minimumBookingNoticeMinutes: 30,
        maximumBookingDaysAhead: 30,
        maximumQuantity: 10,
        timezone: "Asia/Ho_Chi_Minh",
      },
    });
  }
}

async function seedAdmin() {
  const username = requiredEnv("ADMIN_USERNAME").toLowerCase();
  const email = requiredEnv("ADMIN_EMAIL").toLowerCase();
  const password = requiredEnv("ADMIN_PASSWORD");

  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must have at least 12 characters.");
  }

  const existing = await prisma.admin.findFirst({
    where: {
      OR: [{ username }, { email }],
    },
  });

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.admin.create({
      data: {
        username,
        email,
        passwordHash,
        role: "ADMIN",
        isActive: true,
      },
    });
  }
}

async function main() {
  await seedPackages();
  await seedResource();
  await seedSettings();
  await seedAdmin();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed failed.");
    await prisma.$disconnect();
    process.exit(1);
  });
