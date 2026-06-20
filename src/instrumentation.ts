export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { getRuntimeEnv } = await import("@/lib/env");
    getRuntimeEnv();
  }
}
