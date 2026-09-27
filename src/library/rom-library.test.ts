import { afterEach, describe, expect, it, vi } from "vitest";
import { createInesRom } from "../test-utils/ines-rom";
import type { Collection } from "./idb-collection";
import type { UserRomRecord } from "./rom-entry";
import { RomLibrary, RomValidationError } from "./rom-library";

const CATALOG = [
  { id: "super-mario-bros", title: "Super Mario Bros.", file: "super-mario-bros.nes", year: 1985 },
  { title: "Broken entry" },
];

function createMemoryCollection(): Collection<UserRomRecord> {
  const records = new Map<string, UserRomRecord>();
  return {
    getAll: async () => [...records.values()],
    get: async (key) => records.get(key),
    put: async (value) => void records.set(value.id, value),
    delete: async (key) => void records.delete(key),
  };
}

function stubFetch() {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("catalog.json")) return new Response(JSON.stringify(CATALOG));
    return new Response(createInesRom());
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RomLibrary", () => {
  it("loads the built-in catalog ignoring malformed entries", async () => {
    stubFetch();
    const library = new RomLibrary({ baseUrl: "/", userRoms: createMemoryCollection() });

    const entries = await library.load();

    expect(entries).toEqual([expect.objectContaining({ id: "super-mario-bros", source: "built-in" })]);
  });

  it("downloads built-in ROM data from the roms folder", async () => {
    const fetchMock = stubFetch();
    const library = new RomLibrary({ baseUrl: "/app/", userRoms: createMemoryCollection() });
    await library.load();

    const data = await library.readRom("super-mario-bros");

    expect(fetchMock).toHaveBeenLastCalledWith("/app/roms/super-mario-bros.nes");
    expect(data[0]).toBe(0x4e);
  });

  it("keeps subfolders in built-in ROM paths while encoding each segment", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("catalog.json")
        ? new Response(JSON.stringify([{ id: "lj65", title: "LJ65", file: "lj65/lj 65.nes", author: "Damian Yerrick" }]))
        : new Response(createInesRom()),
    );
    vi.stubGlobal("fetch", fetchMock);
    const library = new RomLibrary({ baseUrl: "/", userRoms: createMemoryCollection() });

    const [entry] = await library.load();
    await library.readRom("lj65");

    expect(entry).toMatchObject({ author: "Damian Yerrick" });
    expect(fetchMock).toHaveBeenLastCalledWith("/roms/lj65/lj%2065.nes");
  });

  it("adds user ROMs, lists them first and deduplicates by content", async () => {
    stubFetch();
    const userRoms = createMemoryCollection();
    const library = new RomLibrary({ baseUrl: "/", userRoms });
    await library.load();

    const file = new File([createInesRom()], "my_game (U) [!].nes");
    const first = await library.addUserRom(file);
    const second = await library.addUserRom(file);

    expect(first.persisted).toBe(true);
    expect(first.entry).toMatchObject({ title: "my game", source: "user" });
    expect(first.entry).not.toHaveProperty("data");
    expect(second.entry.id).toBe(first.entry.id);
    expect(library.entries.map((entry) => entry.id)).toEqual([first.entry.id, "super-mario-bros"]);
    expect(await userRoms.getAll()).toHaveLength(1);
  });

  it("keeps user ROMs playable when storage fails", async () => {
    stubFetch();
    const failingCollection: Collection<UserRomRecord> = {
      getAll: () => Promise.reject(new Error("blocked")),
      get: () => Promise.reject(new Error("blocked")),
      put: () => Promise.reject(new Error("blocked")),
      delete: () => Promise.reject(new Error("blocked")),
    };
    const library = new RomLibrary({ baseUrl: "/", userRoms: failingCollection });
    await library.load();

    const { entry, persisted } = await library.addUserRom(new File([createInesRom()], "game.nes"));

    expect(persisted).toBe(false);
    expect(await library.readRom(entry.id)).toHaveLength(createInesRom().length);
  });

  it("rejects files that are not NES ROMs", async () => {
    stubFetch();
    const library = new RomLibrary({ baseUrl: "/", userRoms: createMemoryCollection() });

    await expect(library.addUserRom(new File(["hello"], "fake.nes"))).rejects.toBeInstanceOf(RomValidationError);
  });
});
