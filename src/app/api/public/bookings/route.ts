import { fail, ok, unknownError, validationError } from "@/lib/api-response";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";
import { createBookingSchema } from "@/lib/validation";
import { AvailabilityError } from "@/server/availability";
import { createPublicBooking, SlotConflictError } from "@/server/bookings";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request.headers);
    const rate = checkRateLimit(`public-booking:${ip}`, 8, 10 * 60 * 1000);
    if (!rate.allowed) {
      return fail("RATE_LIMITED", "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.", 429);
    }

    const body = await request.json();
    const parsed = createBookingSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const booking = await createPublicBooking(parsed.data);

    return ok(
      {
        id: booking.id,
        bookingCode: booking.bookingCode,
        bookingDate: booking.bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        packageName: booking.packageName,
        quantity: booking.quantity,
        totalPrice: booking.totalPrice,
        status: booking.status,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SlotConflictError) {
      return fail("SLOT_CONFLICT", error.message, 409);
    }
    if (error instanceof AvailabilityError) {
      return fail("BAD_REQUEST", error.message, 400);
    }
    return unknownError(error);
  }
}
