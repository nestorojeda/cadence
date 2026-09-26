/**
 * Cross-site request protection for the API. Cadence has no login, so without this any web page the athlete visits
 * could POST to it (a `text/plain` form or fetch needs no CORS preflight) and rewrite coach rules or spend the
 * server's LLM key. Used by `middleware.ts`; kept free of Next.js imports so it can be unit-tested.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

/** Why an API request must be refused, or null to let it through. */
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
      // "null" (sandboxed frames, file://) or malformed: treated as cross-site.
    }
    if (!host || originHost !== host) return "Cross-site requests are not allowed.";
  }

  // Browsers only send JSON cross-origin after a CORS preflight, which this app never answers.
  if (BODY_METHODS.has(verb) && !/^application\/json\b/i.test(headers.get("content-type") ?? "")) {
    return "Expected an application/json body.";
  }
  return null;
}
