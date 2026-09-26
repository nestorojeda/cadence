import { safeValidateUIMessages, type UIMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntervalsClient } from "./client";
import { getIntervalsTools } from "./tools";

const ATHLETE = "i12345";
const WORKOUT = { name: "Sweet spot", start_date_local: "2026-09-29T09:00:00" };

type Tools = ReturnType<typeof getIntervalsTools>;

async function run<K extends keyof Tools>(tools: Tools, name: K, input: unknown) {
  const execute = tools[name].execute as unknown as (input: unknown, options: unknown) => Promise<unknown>;
  return execute(input, { toolCallId: "call-1", messages: [] });
}

describe("getIntervalsTools", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      Response.json(init?.method === "POST" ? { id: 1, ...JSON.parse(String(init.body)) } : [])
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const tools = () => getIntervalsTools(new IntervalsClient("key", ATHLETE));
  const paths = () => fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname);

  it("has no athlete_id input on any tool", () => {
    for (const [name, t] of Object.entries(tools())) {
      const shape = (t.inputSchema as unknown as { shape: Record<string, unknown> }).shape;
      expect(Object.keys(shape), name).not.toContain("athlete_id");
    }
  });

  it("drops a model-invented athlete_id when parsing input", () => {
    const schema = tools().icu_create_calendar_event.inputSchema as unknown as {
      parse: (v: unknown) => Record<string, unknown>;
    };
    expect(schema.parse({ ...WORKOUT, athlete_id: "USER_A123" })).not.toHaveProperty("athlete_id");
  });

  it("reads only the bound athlete, whatever athlete_id the model sends", async () => {
    const t = tools();
    await run(t, "icu_get_fitness_summary", { athlete_id: "default_value" });
    await run(t, "icu_get_wellness_data", { athlete_id: "example_athlete" });
    await run(t, "icu_get_recent_activities", { athlete_id: "USER_A123", limit: 5 });
    await run(t, "icu_get_calendar_events", { athlete_id: "USER_A123" });
    expect(paths()).toHaveLength(4);
    for (const path of paths()) expect(path).toMatch(new RegExp(`^/api/v1/athlete/${ATHLETE}/`));
  });

  it("creates events for the bound athlete and doesn't forward extra input keys", async () => {
    // Approved calls run with the input stored in the chat, which isn't re-parsed and may predate the schema change.
    await run(tools(), "icu_create_calendar_event", { ...WORKOUT, type: "Ride", category: "WORKOUT", athlete_id: "USER_A123" });
    expect(paths()).toEqual([`/api/v1/athlete/${ATHLETE}/events`]);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toMatchObject(WORKOUT);
    expect(body).not.toHaveProperty("athlete_id");
  });

  it("creates gym sessions for the bound athlete", async () => {
    const result = await run(tools(), "create_gym_session", {
      ...WORKOUT,
      athlete_id: "USER_A123",
      exercises: [{ name: "Squat (Barbell)", sets: 3, reps: 5 }],
    });
    expect(result).toMatchObject({ intervals: { id: 1 }, hevy: "not_connected" });
    expect(paths()).toEqual([`/api/v1/athlete/${ATHLETE}/events`]);
  });

  it("still validates stored history whose tool inputs carry athlete_id", async () => {
    const stored: UIMessage[] = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "Add a sweet spot ride" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-icu_get_fitness_summary",
            toolCallId: "call-read",
            state: "output-available",
            input: { athlete_id: "default_value" },
            output: { ctl: 50 },
          },
          {
            type: "tool-icu_create_calendar_event",
            toolCallId: "call-write",
            state: "output-available",
            input: { ...WORKOUT, type: "Ride", category: "WORKOUT", athlete_id: "USER_A123" },
            output: { id: 7 },
          },
        ],
      } as UIMessage,
    ];
    const validated = await safeValidateUIMessages({ messages: stored, tools: tools() });
    expect(validated.success).toBe(true);
  });
});
