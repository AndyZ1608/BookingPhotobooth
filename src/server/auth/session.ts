import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE } from "@/lib/constants";
import { getAdminSessionTtlHours, getSessionSecret, isSessionCookieSecure } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { logAdminAuthEvent } from "@/server/auth/logging";

export type AdminSession = {
  id: string;
  adminId: string;
  admin: {
    id: string;
    username: string;
    email: string;
    role: string;
    isActive: boolean;
  };
  expiresAt: Date;
};

export function hashSessionToken(token: string) {
  return createHmac("sha256", getSessionSecret()).update(token).digest("hex");
}

function getSessionTtlSeconds() {
  return getAdminSessionTtlHours() * 60 * 60;
}

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: isSessionCookieSecure(),
    sameSite: "lax" as const,
    path: "/",
  };
}

export function getAdminSessionCookieName() {
  return ADMIN_SESSION_COOKIE;
}

export async function createAdminSession(input: {
  adminId: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const ttlSeconds = getSessionTtlSeconds();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  const session = await prisma.session.create({
    data: {
      adminId: input.adminId,
      tokenHash,
      expiresAt,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
  });

  return { token, expiresAt, maxAge: ttlSeconds, sessionId: session.id };
}

export function setAdminSessionCookie(
  response: NextResponse,
  token: string,
  options?: { maxAge?: number },
) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    ...getCookieOptions(),
    maxAge: options?.maxAge ?? getSessionTtlSeconds(),
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    ...getCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      admin: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
        },
      },
    },
  });

  if (!session) {
    logAdminAuthEvent("admin_session_invalid", { reason: "session_not_found" });
    return null;
  }

  if (session.revokedAt) {
    logAdminAuthEvent("admin_session_invalid", {
      sessionId: session.id,
      adminId: session.adminId,
      reason: "session_revoked",
    });
    return null;
  }

  if (!session.admin.isActive) {
    logAdminAuthEvent("admin_session_invalid", {
      sessionId: session.id,
      adminId: session.adminId,
      reason: "admin_inactive",
    });
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session
      .updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
    logAdminAuthEvent("admin_session_invalid", {
      sessionId: session.id,
      adminId: session.adminId,
      reason: "session_expired",
    });
    return null;
  }

  return {
    id: session.id,
    adminId: session.adminId,
    admin: session.admin,
    expiresAt: session.expiresAt,
  };
}

export async function deleteAdminSessionByToken(token: string | undefined) {
  if (!token) {
    return false;
  }

  const result = await prisma.session.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return result.count > 0;
}

export async function deleteCurrentAdminSession() {
  const cookieStore = await cookies();
  return deleteAdminSessionByToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}
