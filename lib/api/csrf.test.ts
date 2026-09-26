import { describe, expect, it } from "vitest";
import { rejectCrossSite } from "./csrf";

const json = { "content-type": "application/json" };

describe("rejectCrossSite", () => {
  it("lets safe methods through from anywhere", () => {
    expect(rejectCrossSite("GET", new Headers({ "sec-fetch-site": "cross-site" }))).toBeNull();
  });

  it("allows same-origin browser requests", () => {
    const headers = new Headers({ ...json, "sec-fetch-site": "same-origin", origin: "http://localhost:3000" });
    expect(rejectCrossSite("POST", headers)).toBeNull();
    expect(rejectCrossSite("DELETE", new Headers({ "sec-fetch-site": "same-origin" }))).toBeNull();
  });

  it("rejects cross-site and same-site requests", () => {
    expect(rejectCrossSite("POST", new Headers({ ...json, "sec-fetch-site": "cross-site" }))).toMatch(/Cross-site/);
    expect(rejectCrossSite("DELETE", new Headers({ "sec-fetch-site": "same-site" }))).toMatch(/Cross-site/);
  });

  it("falls back to comparing Origin with Host", () => {
    const same = new Headers({ ...json, origin: "http://192.168.1.5:3000", host: "192.168.1.5:3000" });
    expect(rejectCrossSite("POST", same)).toBeNull();
    const other = new Headers({ ...json, origin: "https://evil.example", host: "localhost:3000" });
    expect(rejectCrossSite("POST", other)).toMatch(/Cross-site/);
    expect(rejectCrossSite("POST", new Headers({ ...json, origin: "null", host: "localhost:3000" }))).toMatch(/Cross-site/);
  });

  it("uses the forwarded host behind a reverse proxy", () => {
    const headers = new Headers({
      ...json,
      origin: "https://coach.example",
      host: "localhost:3000",
      "x-forwarded-host": "coach.example",
    });
    expect(rejectCrossSite("POST", headers)).toBeNull();
  });

  it("allows non-browser clients that send JSON", () => {
    expect(rejectCrossSite("POST", new Headers(json))).toBeNull();
    expect(rejectCrossSite("PATCH", new Headers({ "content-type": "application/json; charset=utf-8" }))).toBeNull();
  });

  it("requires a JSON body on POST, PUT and PATCH", () => {
    const form = new Headers({ "content-type": "text/plain", "sec-fetch-site": "same-origin" });
    expect(rejectCrossSite("POST", form)).toMatch(/application\/json/);
    expect(rejectCrossSite("POST", new Headers())).toMatch(/application\/json/);
  });
});
