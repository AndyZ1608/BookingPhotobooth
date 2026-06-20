import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "@/middleware";

describe("admin middleware", () => {
  it("từ chối API admin khi chưa có session cookie", async () => {
    const request = new NextRequest("http://localhost:3000/api/admin/bookings");
    const response = middleware(request);
    const body = (await response.json()) as {
      success: false;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
