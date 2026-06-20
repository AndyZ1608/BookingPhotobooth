import { APP_CURRENCY } from "@/lib/constants";

export function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: APP_CURRENCY,
    maximumFractionDigits: 0,
  }).format(value);
}

export function calculateDurationMinutes(quantity: number, durationPerShotMinutes: number) {
  return quantity * durationPerShotMinutes;
}

export function calculateTotalPrice(quantity: number, unitPrice: number) {
  return quantity * unitPrice;
}
