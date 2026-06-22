import { readFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const prismaMock = vi.hoisted(() => ({
  admin: {
    findFirst: vi.fn(),
  },
  session: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
}));

const cookiesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/headers", () => ({ cookies: cookiesMock }));

const { POST: loginPost } = await import("@/app/api/admin/auth/login/route");
const { POST: logoutPost } = await import("@/app/api/admin/auth/logout/route");
const { getSafeNextPath } = await import("@/lib/navigation");
const { hashSessionToken, getAdminSession } = await import("@/server/auth");
const { resetRateLimit } = await import("@/lib/rate-limit");

const password = "correct-password-123";
const passwordHash = await bcrypt.hash(password, 4);

function makeAdmin(overrides: Partial<{ isActive: boolean; email: string; username: string }> = {}) {
  return {
    id: `admin-${crypto.randomUUID()}`,
    username: overrides.username ?? "admin",
    email: overrides.email ?? "admin@example.com",
    passwordHash,
    role: "ADMIN",
    isActive: overrides.isActive ?? true,
  };
}

function makeLoginRequest(input: {
  identifier: string;
  password: string;
  next?: string;
  ip?: string;
}) {
  return new Request("http://localhost:3000/api/admin/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": input.ip ?? crypto.randomUUID(),
      "user-agent": "vitest",
    },
    body: JSON.stringify({
      identifier: input.identifier,
      password: input.password,
      next: input.next,
    }),
  });
}

function makeLogoutRequest() {
  return new Request("http://localhost:3000/api/admin/auth/logout", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
    },
  });
}

async function readJson(response: Response) {
  return (await response.json()) as {
    success: boolean;
    data?: { redirectTo?: string };
    error?: { code: string; message: string };
  };
}

function setCookieToken(token?: string) {
  cookiesMock.mockResolvedValue({
    get: vi.fn().mockReturnValue(token ? { value: token } : undefined),
  });
}

describe("admin authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SESSION_SECRET", "test-session-secret-with-at-least-32-chars");
    vi.stubEnv("SESSION_COOKIE_SECURE", "false");
    vi.stubEnv("ADMIN_SESSION_TTL_HOURS", "12");
    prismaMock.session.create.mockImplementation(async (input: { data: { tokenHash: string } }) => ({
      id: `session-${input.data.tokenHash.slice(0, 8)}`,
    }));
    prismaMock.session.updateMany.mockResolvedValue({ count: 1 });
  });

  it("login thành công bằng username tạo session và Set-Cookie HTTP-only", async () => {
    const admin = makeAdmin();
    prismaMock.admin.findFirst.mockResolvedValue(admin);

    const response = await loginPost(
      makeLoginRequest({ identifier: " admin ", password, next: "/admin/bookings" }),
    );
    const body = await readJson(response);
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data?.redirectTo).toBe("/admin/bookings");
    expect(prismaMock.session.create).toHaveBeenCalledOnce();
    expect(setCookie).toContain("photobooth_admin_session=");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    expect(setCookie.toLowerCase()).toContain("path=/");
    expect(setCookie.toLowerCase()).not.toContain("secure");
  });

  it("login thành công bằng email và cookie có Secure khi SESSION_COOKIE_SECURE=true", async () => {
    vi.stubEnv("SESSION_COOKIE_SECURE", "true");
    prismaMock.admin.findFirst.mockResolvedValue(makeAdmin({ email: "owner@example.com" }));

    const response = await loginPost(
      makeLoginRequest({ identifier: "OWNER@example.com", password }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")?.toLowerCase()).toContain("secure");
  });

  it("database chỉ lưu token hash, không lưu raw token", async () => {
    prismaMock.admin.findFirst.mockResolvedValue(makeAdmin());

    const response = await loginPost(makeLoginRequest({ identifier: "admin", password }));
    const setCookie = response.headers.get("set-cookie") ?? "";
    const rawToken = /photobooth_admin_session=([^;]+)/.exec(setCookie)?.[1];
    const createCall = prismaMock.session.create.mock.calls[0]?.[0] as {
      data: { tokenHash: string };
    };

    expect(rawToken).toBeTruthy();
    expect(createCall.data.tokenHash).toHaveLength(64);
    expect(createCall.data.tokenHash).not.toBe(rawToken);
    expect(createCall.data.tokenHash).toBe(hashSessionToken(rawToken ?? ""));
  });

  it("password sai, admin không tồn tại, admin inactive đều trả 401 chung", async () => {
    prismaMock.admin.findFirst.mockResolvedValueOnce(makeAdmin());
    const wrongPassword = await loginPost(
      makeLoginRequest({ identifier: "admin-a", password: "wrong-password" }),
    );

    prismaMock.admin.findFirst.mockResolvedValueOnce(null);
    const missingAdmin = await loginPost(
      makeLoginRequest({ identifier: "missing-admin", password }),
    );

    prismaMock.admin.findFirst.mockResolvedValueOnce(makeAdmin({ isActive: false }));
    const inactiveAdmin = await loginPost(
      makeLoginRequest({ identifier: "inactive-admin", password }),
    );

    await expect(readJson(wrongPassword)).resolves.toMatchObject({
      success: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
    await expect(readJson(missingAdmin)).resolves.toMatchObject({
      success: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
    await expect(readJson(inactiveAdmin)).resolves.toMatchObject({
      success: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
    expect(wrongPassword.status).toBe(401);
    expect(missingAdmin.status).toBe(401);
    expect(inactiveAdmin.status).toBe(401);
  });

  it("password đúng reset failed login counter", async () => {
    const identifier = `reset-${crypto.randomUUID()}`;
    const ip = "10.0.0.10";
    prismaMock.admin.findFirst.mockResolvedValue(makeAdmin({ username: identifier }));

    for (let index = 0; index < 4; index += 1) {
      const response = await loginPost(
        makeLoginRequest({ identifier, password: "wrong-password", ip }),
      );
      expect(response.status).toBe(401);
    }

    const success = await loginPost(makeLoginRequest({ identifier, password, ip }));
    expect(success.status).toBe(200);

    const afterReset = await loginPost(
      makeLoginRequest({ identifier, password: "wrong-password", ip }),
    );
    expect(afterReset.status).toBe(401);

    resetRateLimit(`admin-login:${ip}:${identifier}`);
  });

  it("5 lần sai bị 429 và user A không khóa user B", async () => {
    const ip = "10.0.0.20";
    const userA = `user-a-${crypto.randomUUID()}`;
    const userB = `user-b-${crypto.randomUUID()}`;
    prismaMock.admin.findFirst.mockResolvedValue(makeAdmin());

    for (let index = 0; index < 4; index += 1) {
      const response = await loginPost(
        makeLoginRequest({ identifier: userA, password: "wrong-password", ip }),
      );
      expect(response.status).toBe(401);
    }

    const limited = await loginPost(
      makeLoginRequest({ identifier: userA, password: "wrong-password", ip }),
    );
    const userBResponse = await loginPost(makeLoginRequest({ identifier: userB, password, ip }));

    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
    await expect(readJson(limited)).resolves.toMatchObject({
      success: false,
      error: { code: "RATE_LIMITED" },
    });
    expect(userBResponse.status).toBe(200);

    resetRateLimit(`admin-login:${ip}:${userA}`);
    resetRateLimit(`admin-login:${ip}:${userB}`);
  });

  it("session cookie hợp lệ truy cập được, session hết hạn bị từ chối", async () => {
    const token = crypto.randomUUID();
    const admin = makeAdmin();
    setCookieToken(token);
    prismaMock.session.findUnique.mockResolvedValueOnce({
      id: "session-ok",
      adminId: admin.id,
      admin,
      tokenHash: hashSessionToken(token),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(getAdminSession()).resolves.toMatchObject({
      id: "session-ok",
      admin: { username: admin.username },
    });

    prismaMock.session.findUnique.mockResolvedValueOnce({
      id: "session-expired",
      adminId: admin.id,
      admin,
      tokenHash: hashSessionToken(token),
      revokedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(getAdminSession()).resolves.toBeNull();
    expect(prismaMock.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session-expired", revokedAt: null },
      }),
    );
  });

  it("logout revoke database session và xóa cookie", async () => {
    const token = crypto.randomUUID();
    setCookieToken(token);

    const response = await logoutPost(makeLogoutRequest());
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(prismaMock.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenHash: hashSessionToken(token), revokedAt: null },
      }),
    );
    expect(setCookie).toContain("photobooth_admin_session=");
    expect(setCookie.toLowerCase()).toContain("max-age=0");
  });

  it("safe next path không cho open redirect", () => {
    expect(getSafeNextPath("/admin/bookings")).toBe("/admin/bookings");
    expect(getSafeNextPath("https://example.com/admin")).toBe("/admin");
    expect(getSafeNextPath("//example.com/admin")).toBe("/admin");
    expect(getSafeNextPath(null)).toBe("/admin");
  });

  it("login form chỉ có một submit handler và không có button onClick fetch", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/admin/admin-login-form.tsx"),
      "utf8",
    );

    expect(source.match(/fetch\("\/api\/admin\/auth\/login"/g)).toHaveLength(1);
    expect(source).toContain("<form onSubmit={handleSubmit}");
    expect(source).not.toContain("onClick={handleSubmit}");
  });

  it("Prisma Client import mặc định load được", async () => {
    const prismaClientModule = await import("@prisma/client");

    expect(prismaClientModule.PrismaClient).toBeTypeOf("function");
  });
});
