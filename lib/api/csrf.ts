// No login: without this any page the athlete visits could POST here (`text/plain` needs no CORS preflight).
// Kept free of Next.js imports so it can be unit-tested.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

export function rejectCrossSite(method: string, headers: Headers): string | null {
  const verb = method.toUpperCase();
  if (SAFE_METHODS.has(verb)) return null;

  // Set by every current browser and not settable by page scripts; "none" is the athlete typing a URL.
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return "Cross-site requests are not allowed.";
  }
  // Older browsers: compare Origin with the host the request was sent to. Non-browser clients (curl) send neither.
  const origin = headers.get("origin");
  if (!fetchSite && origin) {
    const host = headers.get("x-forwarded-host") ?? headers.get("host");
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
    }
    if (!host || originHost !== host) return "Cross-site requests are not allowed.";
  }

  // Browsers only send JSON cross-origin after a CORS preflight, which this app never answers.
  if (BODY_METHODS.has(verb) && !/^application\/json\b/i.test(headers.get("content-type") ?? "")) {
    return "Expected an application/json body.";
  }
  return null;
}
