import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export async function getDefaultResource(db: Db = prisma) {
  const resource = await db.resource.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (!resource) {
    throw new Error("Chưa có resource photobooth hoạt động. Vui lòng chạy seed dữ liệu.");
  }

  return resource;
}
