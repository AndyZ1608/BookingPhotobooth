import { fail, ok, unknownError, validationError } from "@/lib/api-response";
import { settingsSchema } from "@/lib/validation";
import { getBusinessSettings, updateBusinessSettings } from "@/server/settings";
import { adminAuthErrorResponse, requireAdminSession } from "@/server/auth";
import { writeAuditLog } from "@/server/audit";
import { assertSameOrigin } from "@/server/security";

export async function GET() {
  try {
    await requireAdminSession();
    return ok(await getBusinessSettings());
  } catch (error) {
    const authError = adminAuthErrorResponse(error);
    if (authError) return authError;

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail("UNAUTHORIZED", "Vui lòng đăng nhập.", 401);
    }
    return unknownError(error);
  }
}

export async function PATCH(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const admin = await requireAdminSession();
    const body = await request.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const settings = await updateBusinessSettings(parsed.data);
    await writeAuditLog({
      adminId: admin.id,
      action: "SETTINGS_UPDATED",
      entityType: "BusinessSetting",
      entityId: settings.id,
      metadata: parsed.data,
    });
    return ok(settings);
  } catch (error) {
    const authError = adminAuthErrorResponse(error);
    if (authError) return authError;

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail("UNAUTHORIZED", "Vui lòng đăng nhập.", 401);
    }
    return unknownError(error);
  }
}
