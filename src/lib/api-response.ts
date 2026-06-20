import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "SLOT_CONFLICT"
  | "INTERNAL_ERROR";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(code: ApiErrorCode, message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status },
  );
}

export function validationError(error: ZodError) {
  return fail(
    "VALIDATION_ERROR",
    "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin.",
    422,
    error.flatten(),
  );
}

export function unknownError(error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    return fail(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Có lỗi không xác định.",
      500,
    );
  }

  return fail("INTERNAL_ERROR", "Hệ thống đang bận. Vui lòng thử lại sau.", 500);
}
