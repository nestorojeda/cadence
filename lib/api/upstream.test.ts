import { describe, expect, it } from "vitest";
import { upstreamError } from "./upstream";

describe("upstreamError", () => {
  it("includes status, hint and body", async () => {
    const error = await upstreamError(new Response("bad key", { status: 401 }), "fetch things", " — check the key");
    expect(error.message).toBe("Failed to fetch things (401) — check the key: bad key");
  });

  it("truncates long bodies and collapses whitespace", async () => {
    const html = `<html>\n  <body>${"x".repeat(1000)}</body>\n</html>`;
    const error = await upstreamError(new Response(html, { status: 502 }), "fetch things");
    expect(error.message.length).toBeLessThan(360);
    expect(error.message).toMatch(/^Failed to fetch things \(502\): <html> <body>x+…$/);
  });

  it("omits an empty body", async () => {
    const error = await upstreamError(new Response(null, { status: 500 }), "fetch things");
    expect(error.message).toBe("Failed to fetch things (500)");
  });
});
