export type RomSource = "built-in" | "user";

export interface RomEntry {
  id: string;
  title: string;
  source: RomSource;
  year?: number;
  genre?: string;
  sizeBytes?: number;
}

export interface BuiltInRomEntry extends RomEntry {
  source: "built-in";
  file: string;
}

export interface UserRomRecord extends RomEntry {
  source: "user";
  data: Uint8Array;
  addedAt: number;
}
