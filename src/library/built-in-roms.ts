import type { BuiltInRomEntry } from "./rom-entry";

const ROMS_DIRECTORY = "roms/";
const CATALOG_FILE = "catalog.json";

interface CatalogItem {
  id: string;
  title: string;
  file: string;
  year?: number;
  genre?: string;
  author?: string;
}

function isCatalogItem(value: unknown): value is CatalogItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && typeof item.title === "string" && typeof item.file === "string";
}

export function parseCatalog(json: unknown): BuiltInRomEntry[] {
  if (!Array.isArray(json)) return [];
  return json.filter(isCatalogItem).map(({ id, title, file, year, genre, author }) => ({
    id,
    title,
    file,
    year,
    genre,
    author,
    source: "built-in",
  }));
}

export function resolveRomUrl(baseUrl: string, file: string): string {
  const encodedPath = file.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}${ROMS_DIRECTORY}${encodedPath}`;
}

export async function fetchBuiltInRoms(baseUrl: string): Promise<BuiltInRomEntry[]> {
  const response = await fetch(`${baseUrl}${ROMS_DIRECTORY}${CATALOG_FILE}`);
  if (!response.ok) throw new Error(`Could not load the ROM catalog (${response.status})`);
  return parseCatalog(await response.json());
}

export async function fetchBuiltInRomData(baseUrl: string, entry: BuiltInRomEntry): Promise<Uint8Array> {
  const response = await fetch(resolveRomUrl(baseUrl, entry.file));
  if (!response.ok) throw new Error(`Could not download ${entry.file} (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}
