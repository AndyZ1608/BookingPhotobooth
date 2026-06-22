import type { Metadata } from "next";

import "@/app/globals.css";
import { BRAND } from "@/config/brand";

export const metadata: Metadata = {
  title: "MOMENTME BOOTH | Hidden velvet moments",
  description: `Đặt lịch chụp ảnh tại ${BRAND.name} - ${BRAND.address}.`,
  icons: {
    icon: BRAND.faviconPath,
    shortcut: BRAND.faviconPath,
    apple: BRAND.faviconPath,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
