import { fail, ok, unknownError, validationError } from "@/lib/api-response";
import { blockedTimeSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth";
import { writeAuditLog } from "@/server/audit";
import { getDefaultResource } from "@/server/resources";
import { assertSameOrigin } from "@/server/security";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const date = url.searchParams.get("date") || undefined;
    const blockedTimes = await prisma.blockedTime.findMany({
      where: date ? { date } : undefined,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 200,
    });
    return ok(blockedTimes);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail("UNAUTHORIZED", "Vui lòng đăng nhập.", 401);
    }
    return unknownError(error);
  }
}

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const admin = await requireAdmin();
    const resource = await getDefaultResource();
    const body = await request.json();
    const parsed = blockedTimeSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const blocked = await prisma.blockedTime.create({
      data: {
        resourceId: resource.id,
        date: parsed.data.date,
        startTime: parsed.data.allDay ? "00:00" : parsed.data.startTime,
        endTime: parsed.data.allDay ? "23:59" : parsed.data.endTime,
        allDay: parsed.data.allDay,
        reason: parsed.data.reason || null,
      },
    });
    await writeAuditLog({
      adminId: admin.id,
      action: "BLOCKED_TIME_CREATED",
      entityType: "BlockedTime",
      entityId: blocked.id,
      metadata: parsed.data,
    });
    return ok(blocked, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail("UNAUTHORIZED", "Vui lòng đăng nhập.", 401);
    }
    return unknownError(error);
  }
}
