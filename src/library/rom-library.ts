import { hashBytes } from "../utils/hash";
import { titleFromFileName } from "../utils/format";
import { fetchBuiltInRomData, fetchBuiltInRoms } from "./built-in-roms";
import { createIdbCollection, type Collection } from "./idb-collection";
import type { BuiltInRomEntry, RomEntry, UserRomRecord } from "./rom-entry";
import { validateRom } from "./rom-validator";

export class RomValidationError extends Error {}

export interface AddedRom {
  entry: RomEntry;
  persisted: boolean;
}

interface RomLibraryOptions {
  baseUrl: string;
  userRoms?: Collection<UserRomRecord>;
}

function toEntry({ data: _data, addedAt: _addedAt, ...entry }: UserRomRecord): RomEntry {
  return entry;
}

export class RomLibrary {
  private readonly baseUrl: string;
  private readonly userRomCollection: Collection<UserRomRecord>;
  private builtInRoms: BuiltInRomEntry[] = [];
  // In-memory copy keeps uploaded ROMs playable even when IndexedDB is unavailable (e.g. private mode)
  private readonly userRoms = new Map<string, UserRomRecord>();

  constructor({ baseUrl, userRoms = createIdbCollection<UserRomRecord>("roms") }: RomLibraryOptions) {
    this.baseUrl = baseUrl;
    this.userRomCollection = userRoms;
  }

  get entries(): RomEntry[] {
    const userEntries = [...this.userRoms.values()]
      .sort((first, second) => second.addedAt - first.addedAt)
      .map(toEntry);
    return [...userEntries, ...this.builtInRoms];
  }

  findEntry(id: string): RomEntry | undefined {
    return this.entries.find((entry) => entry.id === id);
  }

  async load(): Promise<RomEntry[]> {
    const [builtInResult, userResult] = await Promise.allSettled([
      fetchBuiltInRoms(this.baseUrl),
      this.userRomCollection.getAll(),
    ]);

    if (builtInResult.status === "fulfilled") this.builtInRoms = builtInResult.value;
    else console.warn(builtInResult.reason);

    if (userResult.status === "fulfilled") {
      for (const record of userResult.value) this.userRoms.set(record.id, record);
    }

    return this.entries;
  }

  async readRom(id: string): Promise<Uint8Array> {
    const userRom = this.userRoms.get(id);
    if (userRom) return userRom.data;

    const builtInRom = this.builtInRoms.find((entry) => entry.id === id);
    if (!builtInRom) throw new Error(`Unknown ROM: ${id}`);
    return fetchBuiltInRomData(this.baseUrl, builtInRom);
  }

  async addUserRom(file: File): Promise<AddedRom> {
    const data = new Uint8Array(await file.arrayBuffer());
    const validation = validateRom(data);
    if (!validation.valid) throw new RomValidationError(`${file.name}: ${validation.reason}`);

    const record: UserRomRecord = {
      id: `user-${hashBytes(data)}-${data.length}`,
      title: titleFromFileName(file.name),
      source: "user",
      sizeBytes: data.length,
      data,
      addedAt: Date.now(),
    };
    this.userRoms.set(record.id, record);

    try {
      await this.userRomCollection.put(record);
      return { entry: toEntry(record), persisted: true };
    } catch {
      return { entry: toEntry(record), persisted: false };
    }
  }

  async removeUserRom(id: string): Promise<void> {
    this.userRoms.delete(id);
    await this.userRomCollection.delete(id).catch(() => {});
  }
}
