import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { fail, ok, unknownError, validationError } from "@/lib/api-response";
import { getSafeNextPath } from "@/lib/navigation";
import {
  getClientIp,
  getRateLimitStatus,
  recordRateLimitFailure,
  resetRateLimit,
} from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { createAdminSession, setAdminSessionCookie } from "@/server/auth";
import { logAdminAuthEvent } from "@/server/auth/logging";

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const INVALID_CREDENTIALS_MESSAGE = "Thông tin đăng nhập không đúng.";

function makeLoginRateLimitKey(ipAddress: string, identifier: string) {
  return `admin-login:${ipAddress}:${identifier}`;
}

function retryAfterSeconds(resetAt: number) {
  return Math.max(Math.ceil((resetAt - Date.now()) / 1000), 1);
}

export async function POST(request: Request) {
  let normalizedIdentifier = "";
  const ipAddress = getClientIp(request.headers);

  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    normalizedIdentifier = parsed.data.identifier.trim().toLowerCase();
    const rateLimitKey = makeLoginRateLimitKey(ipAddress, normalizedIdentifier);
    const status = getRateLimitStatus(rateLimitKey, LOGIN_LIMIT);

    if (!status.allowed) {
      logAdminAuthEvent("admin_login_rate_limited", {
        identifier: normalizedIdentifier,
        ipAddress,
      });

      const response = fail(
        "RATE_LIMITED",
        "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.",
        429,
      );
      response.headers.set("Retry-After", String(retryAfterSeconds(status.resetAt)));
      return response;
    }

    const admin = await prisma.admin.findFirst({
      where: {
        OR: [
          { username: { equals: normalizedIdentifier, mode: "insensitive" } },
          { email: { equals: normalizedIdentifier, mode: "insensitive" } },
        ],
      },
    });

    const validCredentials =
      admin?.isActive === true && (await bcrypt.compare(parsed.data.password, admin.passwordHash));

    if (!validCredentials || !admin) {
      const failed = recordRateLimitFailure(rateLimitKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);
      logAdminAuthEvent("admin_login_invalid_credentials", {
        identifier: normalizedIdentifier,
        ipAddress,
      });

      const response = failed.allowed
        ? fail("INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE, 401)
        : fail(
            "RATE_LIMITED",
            "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.",
            429,
          );

      if (!failed.allowed) {
        response.headers.set("Retry-After", String(retryAfterSeconds(failed.resetAt)));
      }

      return response;
    }

    const session = await createAdminSession({
      adminId: admin.id,
      ipAddress,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    resetRateLimit(rateLimitKey);

    logAdminAuthEvent("admin_session_created", {
      adminId: admin.id,
      sessionId: session.sessionId,
      ipAddress,
    });
    logAdminAuthEvent("admin_login_success", {
      adminId: admin.id,
      identifier: normalizedIdentifier,
      ipAddress,
    });

    const response = ok({
      redirectTo: getSafeNextPath(parsed.data.next),
    }) as NextResponse;
    setAdminSessionCookie(response, session.token, { maxAge: session.maxAge });
    return response;
  } catch (error) {
    logAdminAuthEvent("admin_session_invalid", {
      identifier: normalizedIdentifier || undefined,
      ipAddress,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return unknownError(error);
  }
}
