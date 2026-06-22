import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { BRAND, BRAND_LINES } from "@/config/brand";
import { GALLERY_IMAGES } from "@/config/gallery";

const root = process.cwd();
const pngSignature = "89504e470d0a1a0a";
const blockedPayloadFields = [
  ["unit", "Pri", "ce"].join(""),
  ["total", "Pri", "ce"].join(""),
  ["duration", "Minutes"].join(""),
  "endTime",
  "status",
];

function assetPath(src: `/assets/${string}`) {
  return path.join(root, "public", src.replace(/^\//, ""));
}

function expectPngAsset(src: `/assets/${string}`) {
  const filePath = assetPath(src);
  expect(existsSync(filePath)).toBe(true);
  const bytes = readFileSync(filePath);
  expect(bytes.length).toBeGreaterThan(100);
  expect(bytes.subarray(0, 8).toString("hex")).toBe(pngSignature);
}

describe("MOMENTME public booking UI", () => {
  it("cấu hình đúng nhận diện thương hiệu và metadata source", () => {
    expect(BRAND.name).toBe("MOMENTME BOOTH");
    expect(BRAND.slogan).toBe("𝐻𝑖𝑑𝑑𝑒𝑛 𝑣𝑒𝑙𝑣𝑒𝑡 𝑚𝑜𝑚𝑒𝑛𝑡𝑠");
    expect(BRAND.address).toBe("40 Phan Đình Phùng, Ba Đình, Hà Nội");
    expect(BRAND.openingHours).toBe("9:00 sáng - 10:00 tối (hàng ngày)");
    expect(BRAND.logoPath).toBe("/assets/logo.png");
    expect(BRAND.faviconPath).toBe("/assets/favicon.png");
    expect(BRAND_LINES.address).toBe("♥ 40 Phan Đình Phùng, Ba Đình, Hà Nội");
    expect(BRAND_LINES.openingHours).toBe(
      "♥ Giờ mở cửa: 9:00 sáng - 10:00 tối (hàng ngày)",
    );

    const layoutSource = readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
    expect(layoutSource).toContain("MOMENTME BOOTH | Hidden velvet moments");
    expect(layoutSource).toContain("BRAND.faviconPath");
  });

  it("dùng asset nội bộ có thật cho logo, favicon và gallery", () => {
    expectPngAsset(BRAND.logoPath);
    expectPngAsset(BRAND.faviconPath);

    for (const image of GALLERY_IMAGES) {
      expect(image.src.startsWith("/assets/")).toBe(true);
      expect(existsSync(assetPath(image.src))).toBe(true);
    }
  });

  it("giữ luồng booking production và không gửi giá từ frontend", () => {
    const formSource = readFileSync(
      path.join(root, "src/components/booking/booking-form.tsx"),
      "utf8",
    );

    expect(formSource).toContain('fetch("/api/public/packages")');
    expect(formSource).toContain("fetch(`/api/public/availability?");
    expect(formSource).toContain('fetch("/api/public/bookings"');
    expect(formSource).toContain("SLOT_CONFLICT");

    const payload = formSource.match(/body: JSON\.stringify\(\{([\s\S]*?)\}\),/);
    expect(payload).not.toBeNull();
    expect(payload?.[1]).toContain("date");
    expect(payload?.[1]).toContain("startTime: selectedTime");
    expect(payload?.[1]).toContain("packageId: selectedPackageId");
    expect(payload?.[1]).toContain("quantity");
    expect(payload?.[1]).toContain("customerName");
    expect(payload?.[1]).toContain("customerPhone");
    for (const field of blockedPayloadFields) {
      expect(payload?.[1]).not.toContain(field);
    }
  });
});
