import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { applyApprovalResponses, expirePendingApprovals, hasPendingApprovals } from "./approvals";

const WORKOUT = { name: "Sweet spot", start_date_local: "2026-09-29T00:00:00" };

function assistant(parts: unknown[]): UIMessage {
  return { id: "a1", role: "assistant", parts } as UIMessage;
}

const pending = (id: string, input: unknown = WORKOUT) => ({
  type: "tool-icu_create_calendar_event",
  toolCallId: `call-${id}`,
  state: "approval-requested",
  input,
  approval: { id },
});

const responded = (id: string, approved: boolean, input: unknown = WORKOUT, reason?: string) => ({
  ...pending(id, input),
  state: "approval-responded",
  approval: { id, approved, ...(reason ? { reason } : {}) },
});

describe("applyApprovalResponses", () => {
  it("merges the decisions into the stored message", () => {
    const stored = assistant([{ type: "text", text: "Here you go" }, pending("x"), pending("y")]);
    const incoming = assistant([{ type: "text", text: "Here you go" }, responded("x", true), responded("y", false, WORKOUT, "busy")]);
    const merged = applyApprovalResponses(stored, incoming)!;
    expect(merged.parts[1]).toMatchObject({ state: "approval-responded", approval: { id: "x", approved: true } });
    expect(merged.parts[2]).toMatchObject({ state: "approval-responded", approval: { id: "y", approved: false, reason: "busy" } });
  });

  it("always takes tool inputs from the stored copy", () => {
    const stored = assistant([pending("x")]);
    const tampered = assistant([responded("x", true, { ...WORKOUT, name: "Delete everything" })]);
    const merged = applyApprovalResponses(stored, tampered)!;
    expect(merged.parts[0]).toMatchObject({ input: WORKOUT });
  });

  it("leaves unanswered approvals pending", () => {
    const merged = applyApprovalResponses(assistant([pending("x"), pending("y")]), assistant([responded("x", true)]))!;
    expect(merged.parts[1]).toMatchObject({ state: "approval-requested" });
  });

  it("returns null when nothing is answered", () => {
    expect(applyApprovalResponses(assistant([pending("x")]), assistant([pending("x")]))).toBeNull();
    expect(applyApprovalResponses(assistant([pending("x")]), assistant([responded("other", true)]))).toBeNull();
  });
});

describe("hasPendingApprovals", () => {
  it("detects approval-requested parts", () => {
    expect(hasPendingApprovals(assistant([pending("x")]))).toBe(true);
    expect(hasPendingApprovals(assistant([responded("x", true)]))).toBe(false);
    expect(hasPendingApprovals(undefined)).toBe(false);
  });
});

describe("expirePendingApprovals", () => {
  it("denies approvals left unanswered", () => {
    const expired = expirePendingApprovals(assistant([pending("x"), responded("y", true)]));
    expect(expired.parts[0]).toMatchObject({ state: "output-denied", input: WORKOUT, approval: { id: "x", approved: false } });
    expect((expired.parts[0] as { approval: { reason: string } }).approval.reason).toMatch(/not added/);
    expect(expired.parts[1]).toMatchObject({ state: "approval-responded" });
  });

  it("returns the same message when nothing is pending", () => {
    const message = assistant([{ type: "text", text: "hi" }]);
    expect(expirePendingApprovals(message)).toBe(message);
  });
});
