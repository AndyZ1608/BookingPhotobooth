import { fail, ok, unknownError } from "@/lib/api-response";
import { getVietnamNow } from "@/lib/time";
import { prisma } from "@/lib/prisma";
import { adminAuthErrorResponse, requireAdminSession } from "@/server/auth";

export async function GET() {
  try {
    await requireAdminSession();
    const today = getVietnamNow().date;

    const bookings = await prisma.booking.groupBy({
      by: ["status"],
      where: { bookingDate: today },
      _count: { status: true },
    });

    const counts = Object.fromEntries(bookings.map((item) => [item.status, item._count.status]));

    return ok({
      date: today,
      totalToday: bookings.reduce((sum, item) => sum + item._count.status, 0),
      pending: counts.PENDING ?? 0,
      confirmed: counts.CONFIRMED ?? 0,
      completed: counts.COMPLETED ?? 0,
      cancelled: counts.CANCELLED ?? 0,
    });
  } catch (error) {
    const authError = adminAuthErrorResponse(error);
    if (authError) return authError;

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail("UNAUTHORIZED", "Vui lòng đăng nhập.", 401);
    }
    return unknownError(error);
  }
}
