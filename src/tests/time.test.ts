import { describe, expect, it } from "vitest";

import { calculateDurationMinutes, generateSlotTimes, hasContiguousSlots } from "@/lib/time";

describe("time helpers", () => {
  it("tính duration theo quantity và duration mỗi lần", () => {
    expect(calculateDurationMinutes(3, 10)).toBe(30);
  });

  it("sinh danh sách slot 10 phút liên tục", () => {
    expect(generateSlotTimes("10:00", 30, 10)).toEqual(["10:00", "10:10", "10:20"]);
  });

  it("kiểm tra đủ slot liên tục", () => {
    expect(hasContiguousSlots(["10:00", "10:10", "10:20"], "10:00", 3, 10)).toBe(true);
    expect(hasContiguousSlots(["10:00", "10:20"], "10:00", 3, 10)).toBe(false);
  });
});
