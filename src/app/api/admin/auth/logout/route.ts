import { NextResponse } from "next/server";

import { ok, unknownError } from "@/lib/api-response";
import { clearAdminSessionCookie, deleteCurrentAdminSession } from "@/server/auth";
import { logAdminAuthEvent } from "@/server/auth/logging";
import { assertSameOrigin } from "@/server/security";

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const deleted = await deleteCurrentAdminSession();
    const response = ok({ loggedOut: true }) as NextResponse;
    clearAdminSessionCookie(response);
    logAdminAuthEvent("admin_logout_success", {
      reason: deleted ? "session_revoked" : "session_missing",
    });
    return response;
  } catch (error) {
    return unknownError(error);
  }
}
