/**
 * Map technical / platform errors to short English copy for shoppers.
 * Includes Cloudflare Worker CPU/memory limit (Error 1102).
 */

export const SITE_OVERLOADED_MESSAGE =
  "The website is overloaded right now. Please come back in 2 minutes.";

const OVERLOAD_PATTERNS = [
  /worker exceeded resource limits/i,
  /error\s*1102/i,
  /exceeded (cpu|memory|resource)/i,
  /script exceeded/i,
  /cpu time limit/i,
  /network connection lost/i,
  /failed to fetch/i,
  /fetch failed/i,
  /econnreset/i,
  /etimedout/i,
  /service unavailable/i,
  /bad gateway/i,
  /gateway timeout/i,
  /checkout timed out/i,
  /server may be overloaded/i,
  /the website is overloaded/i
];

export function isSiteOverloadedError(error: unknown): boolean {
  const text = errorText(error);
  if (!text) return false;
  return OVERLOAD_PATTERNS.some((re) => re.test(text));
}

export function errorText(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || "";
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "";
}

/** Prefer overload copy; otherwise return original (or fallback). */
export function toUserFacingError(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (isSiteOverloadedError(error)) return SITE_OVERLOADED_MESSAGE;
  const text = errorText(error).trim();
  if (!text) return fallback;
  // Hide raw stack-ish / internal noise
  if (text.length > 280 || /at\s+\S+\s+\(/.test(text)) return fallback;
  return text;
}
