import type { EmulatorSnapshot } from "../emulator/nes-emulator";
import { createIdbCollection, type Collection } from "./idb-collection";

export interface SnapshotRecord {
  romId: string;
  snapshot: EmulatorSnapshot;
  savedAt: number;
}

export class SnapshotStore {
  constructor(private readonly collection: Collection<SnapshotRecord> = createIdbCollection("snapshots")) {}

  async save(romId: string, snapshot: EmulatorSnapshot): Promise<void> {
    await this.collection.put({ romId, snapshot, savedAt: Date.now() });
  }

  async load(romId: string): Promise<SnapshotRecord | undefined> {
    return this.collection.get(romId);
  }

  async delete(romId: string): Promise<void> {
    await this.collection.delete(romId);
  }
}
