export function getSafeNextPath(value: string | null | undefined) {
  if (!value) return "/admin";
  if (!value.startsWith("/") || value.startsWith("//")) return "/admin";

  try {
    const parsed = new URL(value, "http://local.invalid");
    if (parsed.origin !== "http://local.invalid") {
      return "/admin";
    }
  } catch {
    return "/admin";
  }

  return value;
}
