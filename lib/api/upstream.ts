const MAX_ERROR_BODY_CHARS = 300;

export async function upstreamError(res: Response, what: string, hint = ""): Promise<Error> {
  const body = (await res.text().catch(() => "")).replace(/\s+/g, " ").trim();
  const detail = body.length > MAX_ERROR_BODY_CHARS ? `${body.slice(0, MAX_ERROR_BODY_CHARS)}…` : body;
  return new Error(`Failed to ${what} (${res.status})${hint}${detail ? `: ${detail}` : ""}`);
}
