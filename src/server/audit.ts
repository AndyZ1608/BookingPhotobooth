import type { Prisma } from "@/generated/prisma";

import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function writeAuditLog(
  input: {
    adminId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: unknown;
    ipAddress?: string;
  },
  db: Db = prisma,
) {
  return db.auditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: toJsonValue(input.metadata),
      ipAddress: input.ipAddress,
    },
  });
}
