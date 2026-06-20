import { fail, ok, unknownError, validationError } from "@/lib/api-response";
import { getClientIp } from "@/lib/rate-limit";
import { adminBookingPatchSchema } from "@/lib/validation";
import { requireAdmin } from "@/server/auth";
import { getBookingById, SlotConflictError, updateBooking } from "@/server/bookings";
import { assertSameOrigin } from "@/server/security";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: Params) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const booking = await getBookingById(id);
    if (!booking) return fail("NOT_FOUND", "Không tìm thấy booking.", 404);
    return ok(booking);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail("UNAUTHORIZED", "Vui lòng đăng nhập.", 401);
    }
    return unknownError(error);
  }
}

export async function PATCH(request: Request, context: Params) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = adminBookingPatchSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const booking = await updateBooking({
      id,
      adminId: admin.id,
      ipAddress: getClientIp(request.headers),
      ...parsed.data,
    });

    return ok(booking);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail("UNAUTHORIZED", "Vui lòng đăng nhập.", 401);
    }
    if (error instanceof SlotConflictError) {
      return fail("SLOT_CONFLICT", error.message, 409);
    }
    if (error instanceof Error && error.message === "Không tìm thấy booking.") {
      return fail("NOT_FOUND", error.message, 404);
    }
    return unknownError(error);
  }
}
