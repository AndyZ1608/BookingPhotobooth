import "dotenv/config";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

const DEFAULT_PACKAGES = [
  {
    code: "BASIC",
    name: "Gói 80K",
    unitPrice: 80_000,
    durationPerShotMinutes: 10,
    sortOrder: 1,
  },
  {
    code: "PREMIUM",
    name: "Gói 120K",
    unitPrice: 120_000,
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
    await prisma.package.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        unitPrice: item.unitPrice,
        durationPerShotMinutes: item.durationPerShotMinutes,
        isActive: true,
        sortOrder: item.sortOrder,
      },
      create: {
        ...item,
        isActive: true,
      },
    });
  }
}

async function seedResource() {
  const existing = await prisma.resource.findFirst({
    where: { name: "Photobooth chính" },
  });

  if (existing) {
    await prisma.resource.update({
      where: { id: existing.id },
      data: { isActive: true },
    });
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
  await prisma.businessSetting.upsert({
    where: { id: "business" },
    update: {},
    create: {
      id: "business",
      openingTime: "09:00",
      closingTime: "22:00",
      slotDurationMinutes: 10,
      minimumBookingNoticeMinutes: 30,
      maximumBookingDaysAhead: 30,
      maximumQuantity: 10,
      timezone: "Asia/Ho_Chi_Minh",
      currency: "VND",
    },
  });
}

async function seedAdmin() {
  const username = requiredEnv("ADMIN_USERNAME").toLowerCase();
  const email = requiredEnv("ADMIN_EMAIL").toLowerCase();
  const password = requiredEnv("ADMIN_PASSWORD");

  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must have at least 12 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.admin.upsert({
    where: { email },
    update: {
      username,
      passwordHash,
      isActive: true,
    },
    create: {
      username,
      email,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });
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
