type Hit = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Hit>();

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hit = buckets.get(key);

  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (hit.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: hit.resetAt };
  }

  hit.count += 1;
  return { allowed: true, remaining: limit - hit.count, resetAt: hit.resetAt };
}

export function getClientIp(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
