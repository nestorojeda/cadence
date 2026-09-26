/**
 * Tool names shared by the server (context pruning) and the chat UI. Kept free of tool implementations so client
 * components can import it.
 */

/** Tool that writes to the calendar — rendered as a workout card instead of in the trace. */
export const CREATE_EVENT_TOOL = "icu_create_calendar_event";

/** Gym session on Intervals.icu (and Hevy, when connected) — rendered as a gym card. */
export const CREATE_GYM_TOOL = "create_gym_session";

/** Changes a planned workout or note (partial update) — rendered as a workout card showing what changes. */
export const UPDATE_EVENT_TOOL = "icu_update_calendar_event";

/** Removes a planned workout or note — rendered as a removal card. */
export const DELETE_EVENT_TOOL = "icu_delete_calendar_event";

/** Read tool whose results give the session cards the event as it was before a change. */
export const GET_EVENTS_TOOL = "icu_get_calendar_events";

/**
 * Tools that change Intervals.icu (or Hevy). Their calls stay in the model context on later turns (they are small, and
 * the coach needs to remember what it scheduled); every other tool is a read whose payload is pruned once answered.
 */
export const WRITE_TOOL_NAMES: readonly string[] = [CREATE_EVENT_TOOL, CREATE_GYM_TOOL, UPDATE_EVENT_TOOL, DELETE_EVENT_TOOL];
