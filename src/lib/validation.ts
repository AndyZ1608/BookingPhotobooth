import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ.");
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Giờ không hợp lệ.");
const bookingStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);

export const phoneSchema = z
  .string()
  .trim()
  .min(9, "Số điện thoại không hợp lệ.")
  .max(20, "Số điện thoại không hợp lệ.")
  .refine((value) => /^(0|\+84)[0-9\s.-]{8,15}$/.test(value), {
    message: "Số điện thoại phải bắt đầu bằng 0 hoặc +84.",
  });

export const customerNameSchema = z
  .string()
  .trim()
  .min(2, "Họ tên phải có ít nhất 2 ký tự.")
  .max(100, "Họ tên tối đa 100 ký tự.");

export const publicAvailabilitySchema = z.object({
  date: dateSchema,
  packageId: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
});

export const createBookingSchema = z.object({
  date: dateSchema,
  startTime: timeSchema,
  packageId: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
  customerName: customerNameSchema,
  customerPhone: phoneSchema,
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập username hoặc email.")
    .max(100, "Username hoặc email quá dài."),
  password: z.string().min(1, "Vui lòng nhập mật khẩu.").max(200, "Mật khẩu quá dài."),
  next: z.string().max(300).optional(),
});

const packageBaseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(100),
  durationPerShotMinutes: z.coerce.number().int().min(5).max(240),
});

export const packageSchema = packageBaseSchema.extend({
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const packagePatchSchema = packageBaseSchema.partial().extend({
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const blockedTimeSchema = z
  .object({
    date: dateSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    allDay: z.boolean().default(false),
    reason: z.string().trim().max(200).optional().or(z.literal("")),
  })
  .refine((value) => value.allDay || value.endTime > value.startTime, {
    message: "Giờ kết thúc phải sau giờ bắt đầu.",
    path: ["endTime"],
  });

export const settingsSchema = z
  .object({
    openingTime: timeSchema,
    closingTime: timeSchema,
    slotDurationMinutes: z.coerce.number().int().min(5).max(60),
    minimumBookingNoticeMinutes: z.coerce.number().int().min(0).max(7 * 24 * 60),
    maximumBookingDaysAhead: z.coerce.number().int().min(1).max(365),
    maximumQuantity: z.coerce.number().int().min(1).max(100),
    timezone: z.literal("Asia/Ho_Chi_Minh"),
  })
  .refine((value) => value.closingTime > value.openingTime, {
    message: "Giờ đóng cửa phải sau giờ mở cửa.",
    path: ["closingTime"],
  });

export const adminBookingPatchSchema = z.object({
  customerName: customerNameSchema.optional(),
  customerPhone: phoneSchema.optional(),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  internalNote: z.string().trim().max(1000).optional().or(z.literal("")),
  date: dateSchema.optional(),
  startTime: timeSchema.optional(),
});

export const statusPatchSchema = z.object({
  status: bookingStatusSchema,
});

export const adminBookingsQuerySchema = z.object({
  date: dateSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  status: bookingStatusSchema.optional(),
  packageId: z.string().min(1).optional(),
  search: z.string().trim().max(100).optional(),
});

export function normalizePhone(phone: string) {
  const compact = phone.replace(/[\s.-]/g, "");
  if (compact.startsWith("+84")) {
    return `0${compact.slice(3)}`;
  }
  return compact;
}
