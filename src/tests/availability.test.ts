import type { BusinessSetting } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildAvailableStartTimes } from "@/server/availability";

function futureDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + 2 * 86_400_000));
}

function settings(): BusinessSetting {
  return {
    id: "business",
    openingTime: "09:00",
    closingTime: "22:00",
    slotDurationMinutes: 10,
    minimumBookingNoticeMinutes: 0,
    maximumBookingDaysAhead: 30,
    maximumQuantity: 10,
    timezone: "Asia/Ho_Chi_Minh",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("availability rules", () => {
  it("không trả start time nếu không đủ slot liên tục", () => {
    const times = buildAvailableStartTimes({
      date: futureDate(),
      durationMinutes: 30,
      settings: settings(),
      bookedSlotTimes: ["10:10"],
      blockedTimes: [],
      startTime: "10:00",
    });

    expect(times).toEqual([]);
  });

  it("không trả start time nếu bị block", () => {
    const times = buildAvailableStartTimes({
      date: futureDate(),
      durationMinutes: 10,
      settings: settings(),
      bookedSlotTimes: [],
      blockedTimes: [{ startTime: "10:00", endTime: "10:30", allDay: false }],
      startTime: "10:00",
    });

    expect(times).toEqual([]);
  });

  it("không trả start time ngoài giờ hoạt động", () => {
    const times = buildAvailableStartTimes({
      date: futureDate(),
      durationMinutes: 30,
      settings: settings(),
      bookedSlotTimes: [],
      blockedTimes: [],
      startTime: "21:40",
    });

    expect(times).toEqual([]);
  });
});
