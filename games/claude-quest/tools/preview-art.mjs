// Renders both pattern tables with their in-game palettes to a PNG, to review art without building the ROM.
// Usage: node games/claude-quest/tools/preview-art.mjs <output.png>
import { writeFile } from "node:fs/promises";
import { BACKGROUND_TILES, buildAssets, PALETTES } from "../art/index.mjs";
import { NES_PALETTE_RGB } from "./nes-palette.mjs";
import { encodePng } from "./png.mjs";

const SCALE = 4;
const TILES_PER_ROW = 16;
const TABLE_PIXELS = TILES_PER_ROW * 8;
const GAP = 8;

function backgroundPaletteFor(tile) {
  const t = BACKGROUND_TILES;
  if (tile >= t.GROUND_TOP && tile <= t.GROUND_FILL + 17 && (tile & 0x0f) <= 0x07) return 0;
  if (tile >= t.CLOUD_LEFT && tile <= t.CLOUD_RIGHT + 1) return 1;
  if ([t.SPIKES, t.SPIKES + 1, t.SPIKES + 16, t.SPIKES + 17].includes(tile)) return 1;
  if ([t.SPRING, t.SPRING + 1, t.SPRING + 16, t.SPRING + 17].includes(tile)) return 0;
  if ([t.TOKEN, t.TOKEN + 1, t.TOKEN + 16, t.TOKEN + 17].includes(tile)) return 3;
  if (tile === t.LIFE_ICON || tile === t.AMMO_ICON || (tile >= t.HEALTH_FULL && tile <= t.HEALTH_EMPTY) || tile >= 0x20) return 2;
  return 3;
}

function spritePaletteFor(tile) {
  if ((tile & 0x0f) >= 0x08 && tile >= 0x40) return 3;
  if (tile >= 0x40) return 1;
  if (tile === 0x2b) return 3;
  if (tile >= 0x26 && tile <= 0x29) return 3;
  if ([0x24, 0x25, 0x34, 0x35].includes(tile)) return 1;
  if (tile >= 0x20) return 2;
  if ((tile & 0x0f) >= 0x08) return 1;
  return 0;
}

const { chr } = buildAssets();
const width = (TABLE_PIXELS * 2 + GAP) * SCALE;
const height = TABLE_PIXELS * SCALE;
const rgb = Buffer.alloc(width * height * 3);

function drawTable(tableOffset, originX, palettes, paletteFor) {
  for (let tile = 0; tile < 256; tile++) {
    const palette = palettes[paletteFor(tile)];
    const tileX = (tile % TILES_PER_ROW) * 8;
    const tileY = Math.floor(tile / TILES_PER_ROW) * 8;
    for (let y = 0; y < 8; y++) {
      const low = chr[tableOffset + tile * 16 + y];
      const high = chr[tableOffset + tile * 16 + y + 8];
      for (let x = 0; x < 8; x++) {
        const color = ((low >> (7 - x)) & 1) | (((high >> (7 - x)) & 1) << 1);
        const value = NES_PALETTE_RGB[palette[color]];
        for (let dy = 0; dy < SCALE; dy++) {
          for (let dx = 0; dx < SCALE; dx++) {
            const px = (originX + tileX + x) * SCALE + dx;
            const py = (tileY + y) * SCALE + dy;
            const offset = (py * width + px) * 3;
            rgb[offset] = value >> 16;
            rgb[offset + 1] = (value >> 8) & 0xff;
            rgb[offset + 2] = value & 0xff;
          }
        }
      }
    }
  }
}

drawTable(0, 0, PALETTES.background, backgroundPaletteFor);
drawTable(4096, TABLE_PIXELS + GAP, PALETTES.sprites, spritePaletteFor);
await writeFile(process.argv[2] ?? "art-preview.png", encodePng(width, height, rgb));
