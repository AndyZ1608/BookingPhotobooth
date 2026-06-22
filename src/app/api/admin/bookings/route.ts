import { fail, ok, unknownError, validationError } from "@/lib/api-response";
import { adminBookingsQuerySchema } from "@/lib/validation";
import { listBookings } from "@/server/bookings";
import { adminAuthErrorResponse, requireAdminSession } from "@/server/auth";

export async function GET(request: Request) {
  try {
    await requireAdminSession();
    const url = new URL(request.url);
    const parsed = adminBookingsQuerySchema.safeParse({
      date: url.searchParams.get("date") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      status: url.searchParams.get("status") || undefined,
      packageId: url.searchParams.get("packageId") || undefined,
      search: url.searchParams.get("search") || undefined,
    });

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const bookings = await listBookings(parsed.data);

    return ok(bookings);
  } catch (error) {
    const authError = adminAuthErrorResponse(error);
    if (authError) return authError;

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail("UNAUTHORIZED", "Vui lòng đăng nhập.", 401);
    }
    return unknownError(error);
  }
}
