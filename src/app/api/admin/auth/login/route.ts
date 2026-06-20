import { NextResponse } from "next/server";

import { fail, ok, unknownError, validationError } from "@/lib/api-response";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";
import {
  createAdminSession,
  setAdminSessionCookie,
  verifyPassword,
} from "@/server/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request.headers);
    const rate = checkRateLimit(`admin-login:${ip}`, 5, 15 * 60 * 1000);
    if (!rate.allowed) {
      return fail("RATE_LIMITED", "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.", 429);
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const identifier = parsed.data.identifier.toLowerCase();
    const admin = await prisma.admin.findFirst({
      where: {
        isActive: true,
        OR: [{ username: identifier }, { email: identifier }],
      },
    });

    if (!admin || !(await verifyPassword(parsed.data.password, admin.passwordHash))) {
      return fail("UNAUTHORIZED", "Thông tin đăng nhập không đúng.", 401);
    }

    const session = await createAdminSession({
      adminId: admin.id,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    const response = ok({
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
    }) as NextResponse;
    setAdminSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    return unknownError(error);
  }
}
