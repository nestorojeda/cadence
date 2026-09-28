import { isToolUIPart, type UIMessage } from "ai";

// Only the decisions come from the client: tool inputs always come from the stored message.

type ToolPart = Extract<UIMessage["parts"][number], { toolCallId: string }>;

const EXPIRED_REASON = "The athlete replied without confirming, so this was not added.";

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

export function hasPendingApprovals(message: UIMessage | undefined): boolean {
  return !!message?.parts.some((part) => isToolUIPart(part) && part.state === "approval-requested");
}

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
        : part,
    ),
  };
}
