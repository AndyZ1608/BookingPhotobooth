import "server-only";

import { fail } from "@/lib/api-response";
import {
  clearAdminSessionCookie,
  getAdminSession,
  type AdminSession,
} from "@/server/auth/session";

export class AdminAuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 = 401,
  ) {
    super(message);
    this.name = "AdminAuthError";
  }
}

export async function requireAdminSession(): Promise<AdminSession["admin"]> {
  const session = await getAdminSession();

  if (!session) {
    throw new AdminAuthError("UNAUTHORIZED", 401);
  }

  if (!session.admin.isActive) {
    throw new AdminAuthError("FORBIDDEN", 403);
  }

  return session.admin;
}

export function adminAuthErrorResponse(error: unknown) {
  if (!(error instanceof AdminAuthError)) {
    return null;
  }

  if (error.status === 403) {
    const response = fail("FORBIDDEN", "Tài khoản không có quyền truy cập.", 403);
    clearAdminSessionCookie(response);
    return response;
  }

  const response = fail("UNAUTHORIZED", "Vui lòng đăng nhập.", 401);
  clearAdminSessionCookie(response);
  return response;
}
