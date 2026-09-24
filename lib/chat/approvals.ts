import { isToolUIPart, type UIMessage } from "ai";

/**
 * Human-in-the-loop for write tools. The route pauses on `approval-requested` tool parts (see `toolApproval` in
 * app/api/chat/route.ts); the athlete's decisions come back as the paused assistant message. Only the decisions are
 * taken from the client: tool inputs always come from the stored message, so nothing can be altered while approving.
 */

type ToolPart = Extract<UIMessage["parts"][number], { toolCallId: string }>;

/** Reason recorded when the athlete sends a new message instead of answering pending approvals. */
const EXPIRED_REASON = "The athlete replied without confirming, so this was not added.";

/**
 * Merges the approve/deny decisions from the client's copy of `stored` into it. Returns null when the incoming message
 * answers none of the pending approvals.
 */
export function applyApprovalResponses(stored: UIMessage, incoming: UIMessage): UIMessage | null {
  const decisions = new Map<string, { approved: boolean; reason?: string }>();
  for (const part of incoming.parts) {
    if (isToolUIPart(part) && part.state === "approval-responded" && typeof part.approval.approved === "boolean") {
      decisions.set(part.approval.id, {
        approved: part.approval.approved,
        reason: typeof part.approval.reason === "string" ? part.approval.reason : undefined,
      });
    }
  }

  let answered = 0;
  const parts = stored.parts.map((part) => {
    if (!isToolUIPart(part) || part.state !== "approval-requested") return part;
    const decision = decisions.get(part.approval.id);
    if (!decision) return part;
    answered++;
    return {
      ...part,
      state: "approval-responded",
      approval: { ...part.approval, ...decision },
    } as ToolPart;
  });
  return answered > 0 ? { ...stored, parts } : null;
}

/** True while `message` has tool calls waiting for the athlete's decision. */
export function hasPendingApprovals(message: UIMessage | undefined): boolean {
  return !!message?.parts.some((part) => isToolUIPart(part) && part.state === "approval-requested");
}

/**
 * Declines approvals the athlete left unanswered, so the coach sees that the sessions were not added rather than
 * having the calls silently dropped from its context.
 */
export function expirePendingApprovals(message: UIMessage): UIMessage {
  if (!hasPendingApprovals(message)) return message;
  return {
    ...message,
    parts: message.parts.map((part) =>
      isToolUIPart(part) && part.state === "approval-requested"
        ? ({
            ...part,
            state: "output-denied",
            approval: { ...part.approval, approved: false, reason: EXPIRED_REASON },
          } as ToolPart)
        : part
    ),
  };
}
