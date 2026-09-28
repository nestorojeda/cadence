// Kept free of tool implementations so client components can import it.

export const CREATE_EVENT_TOOL = "icu_create_calendar_event";

export const CREATE_GYM_TOOL = "create_gym_session";

export const UPDATE_EVENT_TOOL = "icu_update_calendar_event";

export const DELETE_EVENT_TOOL = "icu_delete_calendar_event";

export const GET_EVENTS_TOOL = "icu_get_calendar_events";

/** Calls to these stay in the model context on later turns; every other tool's payload is pruned once answered. */
export const WRITE_TOOL_NAMES: readonly string[] = [
  CREATE_EVENT_TOOL,
  CREATE_GYM_TOOL,
  UPDATE_EVENT_TOOL,
  DELETE_EVENT_TOOL,
];
