import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HevyClient } from "./client";

type Folder = { id: number; title: string };

function mockFolders(folders: Folder[]) {
  let nextId = 100;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const { pathname, searchParams } = new URL(url);
    if (pathname !== "/v1/routine_folders") return new Response("not found", { status: 404 });
    if (init?.method === "POST") {
      const { routine_folder } = JSON.parse(String(init.body));
      const folder = { id: nextId++, title: routine_folder.title };
      folders.push(folder);
      return Response.json({ routine_folder: folder }, { status: 201 });
    }
    const page = Number(searchParams.get("page"));
    const pageCount = Math.ceil(folders.length / 10);
    if (page > pageCount) return new Response("not found", { status: 404 });
    return Response.json({ page, page_count: pageCount, routine_folders: folders.slice((page - 1) * 10, page * 10) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const posts = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST").length;

describe("HevyClient.getOrCreateFolder", () => {
  // The folder cache is module-wide and keyed by API key, so each test uses its own key.
  let key = 0;
  const client = () => new HevyClient(`test-key-${++key}`);

  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("creates the folder once when several routines ask for it at the same time", async () => {
    const folders: Folder[] = [];
    const fetchMock = mockFolders(folders);
    const hevy = client();

    const ids = await Promise.all([hevy.getOrCreateFolder(), hevy.getOrCreateFolder(), hevy.getOrCreateFolder()]);

    expect(new Set(ids).size).toBe(1);
    expect(posts(fetchMock)).toBe(1);
    expect(folders.filter((f) => f.title === "Cadence")).toHaveLength(1);
  });

  it("reuses an existing folder, the oldest when there are duplicates, across pages", async () => {
    const folders: Folder[] = [
      ...Array.from({ length: 10 }, (_, i) => ({ id: 50 + i, title: `Other ${i}` })),
      { id: 42, title: "Cadence" },
      { id: 7, title: "Cadence" },
    ];
    const fetchMock = mockFolders(folders);

    expect(await client().getOrCreateFolder()).toBe(7);
    expect(posts(fetchMock)).toBe(0);
  });

  it("creates the folder when the account has none (404)", async () => {
    const fetchMock = mockFolders([]);
    expect(await client().getOrCreateFolder()).toBe(100);
    expect(posts(fetchMock)).toBe(1);
  });

  it("retries after a failed lookup instead of caching the failure", async () => {
    const hevy = client();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );
    await expect(hevy.getOrCreateFolder()).rejects.toThrow("(500)");

    mockFolders([{ id: 3, title: "Cadence" }]);
    expect(await hevy.getOrCreateFolder()).toBe(3);
  });
});
