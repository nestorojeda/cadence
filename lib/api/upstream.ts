/** Longest upstream error body kept in an error message. Tool errors go to the model, and an HTML error page is huge. */
const MAX_ERROR_BODY_CHARS = 300;

/** Error for a failed upstream response (Intervals.icu, Hevy): status, optional hint, and a truncated body. */
export async function upstreamError(res: Response, what: string, hint = ""): Promise<Error> {
  const body = (await res.text().catch(() => "")).replace(/\s+/g, " ").trim();
  const detail = body.length > MAX_ERROR_BODY_CHARS ? `${body.slice(0, MAX_ERROR_BODY_CHARS)}…` : body;
  return new Error(`Failed to ${what} (${res.status})${hint}${detail ? `: ${detail}` : ""}`);
}
