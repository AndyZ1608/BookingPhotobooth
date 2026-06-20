import { NextResponse } from "next/server";

import { ok, unknownError } from "@/lib/api-response";
import { clearAdminSessionCookie, revokeCurrentSession } from "@/server/auth";

export async function POST() {
  try {
    await revokeCurrentSession();
    const response = ok({ loggedOut: true }) as NextResponse;
    clearAdminSessionCookie(response);
    return response;
  } catch (error) {
    return unknownError(error);
  }
}
