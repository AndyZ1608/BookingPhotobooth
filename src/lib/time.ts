import { APP_TIMEZONE } from "@/lib/constants";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type BusinessTimeWindow = {
  openingTime: string;
  closingTime: string;
  slotDurationMinutes: number;
  minimumBookingNoticeMinutes: number;
  maximumBookingDaysAhead: number;
  timezone: string;
};

export type BlockInterval = {
  startTime: string;
  endTime: string;
  allDay?: boolean;
};

export function calculateDurationMinutes(quantity: number, durationPerShotMinutes: number) {
  return quantity * durationPerShotMinutes;
}

export function assertDate(value: string) {
  if (!DATE_RE.test(value)) {
    throw new Error("Ngày không hợp lệ.");
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Ngày không hợp lệ.");
  }
}

export function assertTime(value: string) {
  if (!TIME_RE.test(value)) {
    throw new Error("Giờ không hợp lệ.");
  }
}

export function timeToMinutes(time: string) {
  assertTime(time);
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function minutesToTime(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

export function addMinutesToTime(time: string, minutes: number) {
  return minutesToTime(timeToMinutes(time) + minutes);
}

export function getVietnamNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${lookup.year}-${lookup.month}-${lookup.day}`,
    time: `${lookup.hour}:${lookup.minute}`,
    second: lookup.second ?? "00",
  };
}

export function localDateTimeToDate(date: string, time = "00:00") {
  assertDate(date);
  assertTime(time);
  return new Date(`${date}T${time}:00+07:00`);
}

export function getDateDiffInDays(fromDate: string, toDate: string) {
  const from = localDateTimeToDate(fromDate);
  const to = localDateTimeToDate(toDate);
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

export function generateSlotTimes(startTime: string, durationMinutes: number, slotDurationMinutes: number) {
  if (durationMinutes <= 0 || slotDurationMinutes <= 0) {
    throw new Error("Thời lượng slot không hợp lệ.");
  }

  const slotCount = Math.ceil(durationMinutes / slotDurationMinutes);
  const start = timeToMinutes(startTime);

  return Array.from({ length: slotCount }, (_, index) =>
    minutesToTime(start + index * slotDurationMinutes),
  );
}

export function generateStartTimes(openingTime: string, closingTime: string, slotDurationMinutes: number) {
  const opening = timeToMinutes(openingTime);
  const closing = timeToMinutes(closingTime);

  if (closing <= opening) {
    throw new Error("Giờ đóng cửa phải sau giờ mở cửa.");
  }

  const times: string[] = [];
  for (let minute = opening; minute < closing; minute += slotDurationMinutes) {
    times.push(minutesToTime(minute));
  }

  return times;
}

export function isInsideBusinessHours(
  startTime: string,
  durationMinutes: number,
  openingTime: string,
  closingTime: string,
) {
  const start = timeToMinutes(startTime);
  const end = start + durationMinutes;
  return start >= timeToMinutes(openingTime) && end <= timeToMinutes(closingTime);
}

export function isBlockedByIntervals(slotTimes: string[], blocks: BlockInterval[]) {
  return slotTimes.some((slotTime) => {
    const slot = timeToMinutes(slotTime);
    return blocks.some((block) => {
      if (block.allDay) return true;
      return slot >= timeToMinutes(block.startTime) && slot < timeToMinutes(block.endTime);
    });
  });
}

export function isWithinBookingWindow(
  date: string,
  startTime: string,
  settings: Pick<
    BusinessTimeWindow,
    "minimumBookingNoticeMinutes" | "maximumBookingDaysAhead" | "timezone"
  >,
  now = new Date(),
) {
  if (settings.timezone !== APP_TIMEZONE) {
    throw new Error("MVP hiện hỗ trợ múi giờ Asia/Ho_Chi_Minh.");
  }

  const localNow = getVietnamNow(now);
  const dayDiff = getDateDiffInDays(localNow.date, date);

  if (dayDiff < 0) return false;
  if (dayDiff > settings.maximumBookingDaysAhead) return false;

  const bookingAt = localDateTimeToDate(date, startTime);
  const minAllowed = new Date(now.getTime() + settings.minimumBookingNoticeMinutes * 60_000);

  return bookingAt.getTime() >= minAllowed.getTime();
}

export function hasContiguousSlots(slotTimes: string[], startTime: string, requiredSlots: number, slotDuration: number) {
  const available = new Set(slotTimes);

  return generateSlotTimes(startTime, requiredSlots * slotDuration, slotDuration).every((time) =>
    available.has(time),
  );
}
