import { fail, ok, unknownError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth";
import { writeAuditLog } from "@/server/audit";
import { assertSameOrigin } from "@/server/security";

type Params = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: Params) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    await prisma.blockedTime.delete({ where: { id } });
    await writeAuditLog({
      adminId: admin.id,
      action: "BLOCKED_TIME_DELETED",
      entityType: "BlockedTime",
      entityId: id,
    });
    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail("UNAUTHORIZED", "Vui lòng đăng nhập.", 401);
    }
    return unknownError(error);
  }
}
