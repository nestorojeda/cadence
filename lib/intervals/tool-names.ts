/**
 * Tool names shared by the server (context pruning) and the chat UI. Kept free of tool implementations so client
 * components can import it.
 */

/** Tool that writes to the calendar — rendered as a workout card instead of in the trace. */
export const CREATE_EVENT_TOOL = "icu_create_calendar_event";

/** Gym session on Intervals.icu (and Hevy, when connected) — rendered as a gym card. */
export const CREATE_GYM_TOOL = "create_gym_session";

/**
 * Tools that change Intervals.icu (or Hevy). Their calls stay in the model context on later turns (they are small, and
 * the coach needs to remember what it scheduled); every other tool is a read whose payload is pruned once answered.
 */
export const WRITE_TOOL_NAMES: readonly string[] = [CREATE_EVENT_TOOL, CREATE_GYM_TOOL];
