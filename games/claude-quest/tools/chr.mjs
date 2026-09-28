const TILE_SIZE = 8;
const BYTES_PER_TILE = 16;
export const CHR_BANK_SIZE = 8192;
export const TILES_PER_TABLE = 256;

/**
 * Encodes one 8x8 tile drawn with characters into the NES 2-bitplane format.
 * `palette` maps each character to a color index 0-3.
 */
export function encodeTile(rows, palette) {
  if (rows.length !== TILE_SIZE) throw new Error(`A tile needs ${TILE_SIZE} rows, got ${rows.length}`);

  const bytes = new Uint8Array(BYTES_PER_TILE);
  rows.forEach((row, y) => {
    if (row.length !== TILE_SIZE) throw new Error(`Row "${row}" must be ${TILE_SIZE} pixels wide`);
    for (let x = 0; x < TILE_SIZE; x++) {
      const color = palette[row[x]];
      if (color === undefined) throw new Error(`Unknown pixel "${row[x]}" in row "${row}"`);
      const bit = 0x80 >> x;
      if (color & 1) bytes[y] |= bit;
      if (color & 2) bytes[y + TILE_SIZE] |= bit;
    }
  });
  return bytes;
}

/** Splits a (8*w)x(8*h) drawing into tiles, left to right and top to bottom. */
export function splitIntoTiles(rows) {
  const tilesWide = rows[0].length / TILE_SIZE;
  const tilesHigh = rows.length / TILE_SIZE;
  if (!Number.isInteger(tilesWide) || !Number.isInteger(tilesHigh)) {
    throw new Error("Drawings must be a multiple of 8 pixels in both directions");
  }

  const tiles = [];
  for (let tileY = 0; tileY < tilesHigh; tileY++) {
    for (let tileX = 0; tileX < tilesWide; tileX++) {
      tiles.push(
        rows
          .slice(tileY * TILE_SIZE, (tileY + 1) * TILE_SIZE)
          .map((row) => row.slice(tileX * TILE_SIZE, (tileX + 1) * TILE_SIZE)),
      );
    }
  }
  return tiles;
}

/**
 * Collects tiles into a pattern table. `place(index, rows)` puts one tile at an
 * exact slot so C code can refer to it by a fixed number.
 */
export class PatternTable {
  constructor(palette) {
    this.palette = palette;
    this.bytes = new Uint8Array(TILES_PER_TABLE * BYTES_PER_TILE);
    this.used = new Set();
  }

  place(index, rows) {
    if (index < 0 || index >= TILES_PER_TABLE) throw new Error(`Tile index ${index} out of range`);
    if (this.used.has(index)) throw new Error(`Tile index ${index} is already used`);
    this.used.add(index);
    this.bytes.set(encodeTile(rows, this.palette), index * BYTES_PER_TILE);
  }

  /** Places a drawing of any size in tiles, keeping the 16-tiles-per-row metasprite layout. */
  placeBlock(firstIndex, rows) {
    const tilesWide = rows[0].length / 8;
    splitIntoTiles(rows).forEach((tile, index) => {
      this.place(firstIndex + (index % tilesWide) + Math.floor(index / tilesWide) * 16, tile);
    });
  }

  /** Places a 16x16 drawing so its tiles sit at n, n+1, n+16, n+17 (the metasprite layout). */
  placeMeta(firstIndex, rows) {
    const [topLeft, topRight, bottomLeft, bottomRight] = splitIntoTiles(rows);
    this.place(firstIndex, topLeft);
    this.place(firstIndex + 1, topRight);
    this.place(firstIndex + 16, bottomLeft);
    this.place(firstIndex + 17, bottomRight);
  }
}
