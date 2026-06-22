import type { Booking, Prisma } from "@/generated/prisma";

import { BOOKING_STATUS_LABELS } from "@/lib/constants";
import { formatVnd } from "@/lib/money";
import { prisma } from "@/lib/prisma";

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function buildTelegramBookingMessage(booking: Booking) {
  return [
    "📸 LỊCH PHOTOBOOTH MỚI",
    "",
    `Mã lịch: ${booking.bookingCode}`,
    `Khách hàng: ${booking.customerName}`,
    `Số điện thoại: ${booking.customerPhone}`,
    "",
    `Ngày chụp: ${booking.bookingDate}`,
    `Thời gian: ${booking.startTime} - ${booking.endTime}`,
    `Gói chụp: ${booking.packageName}`,
    `Số lần chụp: ${booking.quantity}`,
    `Tổng tiền: ${formatVnd(booking.totalPrice)}`,
    "",
    `Ghi chú: ${booking.note?.trim() ? booking.note : "Không có"}`,
    `Trạng thái: ${BOOKING_STATUS_LABELS.PENDING}`,
  ].join("\n");
}

export async function notifyBookingCreated(booking: Booking) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const message = buildTelegramBookingMessage(booking);

  if (!token || !chatId) {
    await prisma.notificationLog.create({
      data: {
        bookingId: booking.id,
        status: "SKIPPED",
        message,
        error: "TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID chưa được cấu hình.",
        payload: { bookingCode: booking.bookingCode },
      },
    });
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        disable_web_page_preview: true,
      }),
    });

    const body = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new Error(
        typeof body === "object" && body !== null && "description" in body
          ? String((body as { description: unknown }).description)
          : `Telegram HTTP ${response.status}`,
      );
    }

    await prisma.notificationLog.create({
      data: {
        bookingId: booking.id,
        status: "SENT",
        sentAt: new Date(),
        message,
        payload: toJsonValue(body),
      },
    });
  } catch (error) {
    await prisma.notificationLog.create({
      data: {
        bookingId: booking.id,
        status: "FAILED",
        message,
        error: error instanceof Error ? error.message : "Không gửi được Telegram.",
        payload: { bookingCode: booking.bookingCode },
      },
    });
  }
}
