import { fail, ok, unknownError, validationError } from "@/lib/api-response";
import { getClientIp } from "@/lib/rate-limit";
import { statusPatchSchema } from "@/lib/validation";
import { requireAdmin } from "@/server/auth";
import { updateBookingStatus } from "@/server/bookings";
import { assertSameOrigin } from "@/server/security";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Params) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = statusPatchSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const booking = await updateBookingStatus({
      id,
      adminId: admin.id,
      status: parsed.data.status,
      ipAddress: getClientIp(request.headers),
    });

    return ok(booking);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail("UNAUTHORIZED", "Vui lòng đăng nhập.", 401);
    }
    if (error instanceof Error && error.message === "Không tìm thấy booking.") {
      return fail("NOT_FOUND", error.message, 404);
    }
    if (error instanceof Error && error.message === "Trạng thái chuyển đổi không hợp lệ.") {
      return fail("BAD_REQUEST", error.message, 400);
    }
    return unknownError(error);
  }
}
