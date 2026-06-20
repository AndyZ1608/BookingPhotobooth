import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Photobooth Booking",
  description: "Hệ thống đặt lịch cửa hàng photobooth",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
