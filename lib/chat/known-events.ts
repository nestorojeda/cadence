import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { DELETE_EVENT_TOOL, GET_EVENTS_TOOL, UPDATE_EVENT_TOOL, WRITE_TOOL_NAMES } from "@/lib/intervals/tool-names";

/**
 * Calendar events as the coach last read them, for showing what an update or delete changes. Taken from stored tool
 * outputs (Intervals.icu data), never from the model's own claims. Client-safe.
 */

/** A compacted calendar event, as returned by `icu_get_calendar_events` (see lib/intervals/compact.ts). */
export type KnownEvent = Record<string, unknown> & { id: number | string };

function isEvent(value: unknown): value is KnownEvent {
  return !!value && typeof value === "object" && "id" in value && !("error" in value);
}

/**
 * For each update/delete tool call, the event as it was just before that call (keyed by `toolCallId`). Walks the
 * conversation in order, so an old change card keeps its own "before" even after later edits to the same event.
 */
export function eventsBeforeWrites(messages: UIMessage[]): Map<string, KnownEvent> {
  const known = new Map<string, KnownEvent>();
  const before = new Map<string, KnownEvent>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (!isToolUIPart(part)) continue;
      const name = getToolName(part);
      if (name === GET_EVENTS_TOOL && part.state === "output-available" && Array.isArray(part.output)) {
        for (const event of part.output) if (isEvent(event)) known.set(String(event.id), event);
      } else if (name === UPDATE_EVENT_TOOL || name === DELETE_EVENT_TOOL) {
        const eventId = (part.input as { event_id?: unknown } | undefined)?.event_id;
        const previous = eventId != null ? known.get(String(eventId)) : undefined;
        if (previous) before.set(part.toolCallId, previous);
        if (name === UPDATE_EVENT_TOOL && part.state === "output-available" && isEvent(part.output)) {
          known.set(String(part.output.id), { ...previous, ...part.output });
        }
      }
    }
  }
  return before;
}

/** True when `message` holds a calendar write that went through, so views of the calendar need a refresh. */
export function wroteToCalendar(message: UIMessage): boolean {
  return message.parts.some(
    (part) =>
      isToolUIPart(part) &&
      WRITE_TOOL_NAMES.includes(getToolName(part)) &&
      part.state === "output-available" &&
      !(part.output && typeof part.output === "object" && "error" in part.output)
  );
}
