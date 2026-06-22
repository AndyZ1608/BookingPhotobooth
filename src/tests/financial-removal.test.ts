import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const blockedTerms = [
  ["unit", "Pri", "ce"].join(""),
  ["total", "Pri", "ce"].join(""),
  ["total", "Amo", "unt"].join(""),
  ["sub", "total"].join(""),
  ["reve", "nue"].join(""),
  ["curr", "ency"].join(""),
  ["format", "V", "nd"].join(""),
  ["calculate", "Total", "Pri", "ce"].join(""),
  ["V", "ND"].join(""),
  "\u20ab",
  ["80", "K"].join(""),
  ["120", "K"].join(""),
  ["Tổng", " tiền"].join(""),
  ["Doanh", " thu"].join(""),
];

const activeSurfaces = [
  "src/components/booking/booking-form.tsx",
  "src/components/admin/admin-dashboard.tsx",
  "src/server/bookings.ts",
  "src/server/availability.ts",
  "src/server/settings.ts",
  "src/server/telegram.ts",
  "src/app/api/public/packages/route.ts",
  "src/app/api/public/bookings/route.ts",
  "src/app/api/admin/dashboard/summary/route.ts",
  "src/app/api/admin/packages/route.ts",
  "src/app/api/admin/packages/[id]/route.ts",
  "src/app/api/admin/settings/route.ts",
  "src/lib/validation.ts",
  "src/lib/constants.ts",
  "prisma/schema.prisma",
  "prisma/seed.ts",
];

function readSource(file: string) {
  return readFileSync(path.join(root, file), "utf8");
}

describe("financial references removed from active booking surfaces", () => {
  it.each(activeSurfaces)("%s has no active financial term", (file) => {
    const source = readSource(file);

    for (const term of blockedTerms) {
      expect(source.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it("booking request still uses only scheduling and customer fields", () => {
    const source = readSource("src/components/booking/booking-form.tsx");
    const payload = source.match(/body: JSON\.stringify\(\{([\s\S]*?)\}\),/);

    expect(payload).not.toBeNull();
    expect(payload?.[1]).toContain("date");
    expect(payload?.[1]).toContain("startTime: selectedTime");
    expect(payload?.[1]).toContain("packageId: selectedPackageId");
    expect(payload?.[1]).toContain("quantity");
    expect(payload?.[1]).toContain("customerName");
    expect(payload?.[1]).toContain("customerPhone");
    expect(payload?.[1]).toContain("note");
  });
});
