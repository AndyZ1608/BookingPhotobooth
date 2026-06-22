import { fail, ok, unknownError, validationError } from "@/lib/api-response";
import { packageSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { adminAuthErrorResponse, requireAdminSession } from "@/server/auth";
import { writeAuditLog } from "@/server/audit";
import { assertSameOrigin } from "@/server/security";

export async function GET() {
  try {
    await requireAdminSession();
    const packages = await prisma.package.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return ok(packages);
  } catch (error) {
    const authError = adminAuthErrorResponse(error);
    if (authError) return authError;

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
    const admin = await requireAdminSession();
    const body = await request.json();
    const parsed = packageSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const pack = await prisma.package.create({ data: parsed.data });
    await writeAuditLog({
      adminId: admin.id,
      action: "PACKAGE_CREATED",
      entityType: "Package",
      entityId: pack.id,
      metadata: parsed.data,
    });
    return ok(pack, { status: 201 });
  } catch (error) {
    const authError = adminAuthErrorResponse(error);
    if (authError) return authError;

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail("UNAUTHORIZED", "Vui lòng đăng nhập.", 401);
    }
    return unknownError(error);
  }
}
