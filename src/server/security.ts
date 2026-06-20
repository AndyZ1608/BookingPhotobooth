import { fail } from "@/lib/api-response";

export function assertSameOrigin(request: Request) {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  if (!host) {
    return fail("FORBIDDEN", "Yêu cầu không hợp lệ.", 403);
  }

  try {
    const source = origin ?? referer;
    if (!source) {
      return fail("FORBIDDEN", "Yêu cầu không hợp lệ.", 403);
    }

    const sourceUrl = new URL(source);
    if (sourceUrl.host !== host) {
      return fail("FORBIDDEN", "Yêu cầu không cùng nguồn.", 403);
    }
  } catch {
    return fail("FORBIDDEN", "Yêu cầu không hợp lệ.", 403);
  }

  return null;
}
