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

export function getRateLimitStatus(key: string, limit: number) {
  const now = Date.now();
  const hit = buckets.get(key);

  if (!hit || hit.resetAt <= now) {
    buckets.delete(key);
    return { allowed: true, remaining: limit, resetAt: now };
  }

  if (hit.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: hit.resetAt };
  }

  return { allowed: true, remaining: limit - hit.count, resetAt: hit.resetAt };
}

export function recordRateLimitFailure(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hit = buckets.get(key);

  if (!hit || hit.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  hit.count += 1;
  return {
    allowed: hit.count < limit,
    remaining: Math.max(limit - hit.count, 0),
    resetAt: hit.resetAt,
  };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

export function getClientIp(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
