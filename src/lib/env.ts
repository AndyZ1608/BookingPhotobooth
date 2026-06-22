import { z } from "zod";

export const runtimeEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  SESSION_COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false"),
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(12),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
});

export function getRuntimeEnv() {
  return runtimeEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE,
    ADMIN_SESSION_TTL_HOURS: process.env.ADMIN_SESSION_TTL_HOURS,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  });
}

export function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET phải có ít nhất 32 ký tự.");
  }
  return secret;
}

export function isSessionCookieSecure() {
  return process.env.SESSION_COOKIE_SECURE === "true";
}

export function getAdminSessionTtlHours() {
  const parsed = runtimeEnvSchema.shape.ADMIN_SESSION_TTL_HOURS.safeParse(
    process.env.ADMIN_SESSION_TTL_HOURS,
  );

  if (!parsed.success) {
    return 12;
  }

  return parsed.data;
}
