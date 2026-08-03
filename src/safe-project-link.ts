const SAFE_EXTERNAL_PROTOCOL = "https:";

export function resolveSafeProjectHref(
  href: string,
  baseHref: string,
): string | null {
  try {
    const base = new URL(baseHref);
    const resolved = new URL(href.trim(), base);
    const sameOrigin = resolved.origin === base.origin;
    if (sameOrigin && (resolved.protocol === "http:" || resolved.protocol === "https:")) {
      return resolved.href;
    }
    return resolved.protocol === SAFE_EXTERNAL_PROTOCOL ? resolved.href : null;
  } catch {
    return null;
  }
}
