import { describe, expect, it } from "vitest";
import { isAuthorizedCron } from "./cron";

describe("isAuthorizedCron", () => {
  it("accepts only the exact bearer secret", () => {
    expect(isAuthorizedCron("Bearer s3cret", "s3cret")).toBe(true);
    expect(isAuthorizedCron("Bearer s3cre", "s3cret")).toBe(false);
    expect(isAuthorizedCron("s3cret", "s3cret")).toBe(false);
    expect(isAuthorizedCron(null, "s3cret")).toBe(false);
  });

  it("authorizes nothing without a configured secret", () => {
    expect(isAuthorizedCron("Bearer ", "")).toBe(false);
    expect(isAuthorizedCron("Bearer undefined", undefined)).toBe(false);
  });
});
