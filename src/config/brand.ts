export const BRAND = {
  name: "MOMENTME BOOTH",
  slogan: "𝐻𝑖𝑑𝑑𝑒𝑛 𝑣𝑒𝑙𝑣𝑒𝑡 𝑚𝑜𝑚𝑒𝑛𝑡𝑠",
  address: "40 Phan Đình Phùng, Ba Đình, Hà Nội",
  openingHours: "9:00 sáng - 10:00 tối (hàng ngày)",
  logoPath: "/assets/logo.png",
  faviconPath: "/assets/favicon.png",
} as const;

export const BRAND_LINES = {
  address: `♥ ${BRAND.address}`,
  openingHours: `♥ Giờ mở cửa: ${BRAND.openingHours}`,
} as const;
