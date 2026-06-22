import { fail, ok, unknownError, validationError } from "@/lib/api-response";
import { packagePatchSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { adminAuthErrorResponse, requireAdminSession } from "@/server/auth";
import { writeAuditLog } from "@/server/audit";
import { assertSameOrigin } from "@/server/security";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Params) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const admin = await requireAdminSession();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = packagePatchSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const pack = await prisma.package.update({
      where: { id },
      data: parsed.data,
    });
    await writeAuditLog({
      adminId: admin.id,
      action: "PACKAGE_UPDATED",
      entityType: "Package",
      entityId: pack.id,
      metadata: parsed.data,
    });
    return ok(pack);
  } catch (error) {
    const authError = adminAuthErrorResponse(error);
    if (authError) return authError;

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail("UNAUTHORIZED", "Vui lòng đăng nhập.", 401);
    }
    return unknownError(error);
  }
}
