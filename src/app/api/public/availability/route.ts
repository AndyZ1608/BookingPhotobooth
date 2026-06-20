import { fail, ok, unknownError, validationError } from "@/lib/api-response";
import { publicAvailabilitySchema } from "@/lib/validation";
import { AvailabilityError, getAvailableStartTimes } from "@/server/availability";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = publicAvailabilitySchema.safeParse(Object.fromEntries(url.searchParams));

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const availability = await getAvailableStartTimes(parsed.data);
    return ok({
      times: availability.times,
      durationMinutes: availability.durationMinutes,
      settings: {
        maximumQuantity: availability.settings.maximumQuantity,
        slotDurationMinutes: availability.settings.slotDurationMinutes,
        openingTime: availability.settings.openingTime,
        closingTime: availability.settings.closingTime,
      },
    });
  } catch (error) {
    if (error instanceof AvailabilityError) {
      return fail("BAD_REQUEST", error.message, 400);
    }
    return unknownError(error);
  }
}
