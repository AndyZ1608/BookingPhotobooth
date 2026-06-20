export const APP_TIMEZONE = "Asia/Ho_Chi_Minh";
export const APP_CURRENCY = "VND";
export const SLOT_CONFLICT_MESSAGE =
  "Khung giờ vừa được khách hàng khác đặt. Vui lòng chọn giờ khác.";
export const ADMIN_SESSION_COOKIE = "pb_admin_session";
export const SESSION_DURATION_DAYS = 7;

export const BOOKING_STATUS_LABELS = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã check-in",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  NO_SHOW: "Không đến",
} as const;
