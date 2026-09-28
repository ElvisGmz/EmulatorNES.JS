import { CHR_BANK_SIZE, PatternTable } from "../tools/chr.mjs";
import { FONT_GLYPHS, glyphToTile } from "./font.mjs";
import { placeLogo, renderLogo } from "./logo.mjs";
import * as bosses from "./bosses.mjs";
import * as sprites from "./sprites.mjs";
import * as tiles from "./tiles.mjs";

const PIXELS = { ".": 0, a: 1, b: 2, c: 3 };
const LOGO_TEXT = "CLAUDE";
const LOGO_SCALE = 4;

export const SKY_COLOR = 0x0c;
// Cycled into the last sky color at runtime so stars and tokens twinkle together
export const SKY_TWINKLE_COLORS = [0x30, 0x38, 0x28, 0x38];

// NES palette indices: backdrop + 3 colors per sub-palette
export const PALETTES = {
  background: [
    [SKY_COLOR, 0x07, 0x17, 0x2a], // 0 ground: dark soil, soil, grass
    [SKY_COLOR, 0x21, 0x31, 0x30], // 1 clouds
    [SKY_COLOR, 0x30, 0x26, 0x0f], // 2 text: white, Claude orange, black shadow
    [SKY_COLOR, 0x28, 0x38, SKY_TWINKLE_COLORS[0]], // 3 sky and tokens: gold, pale yellow, twinkling white
  ],
  sprites: [
    [SKY_COLOR, 0x0f, 0x26, 0x36], // 0 Claude: outline, orange, peach
    [SKY_COLOR, 0x0f, 0x1a, 0x3a], // 1 bugs and flies: outline, green, pale green
    [SKY_COLOR, 0x26, 0x28, 0x30], // 2 sparkles and Claude when hurt: orange, yellow, white
    [SKY_COLOR, 0x13, 0x23, 0x30], // 3 moving clouds and icicles: purple, lavender, white
  ],
};

// Tile numbers shared with the C code through the generated assets.h
export const BACKGROUND_TILES = {
  EMPTY: 0x00,
  STAR_DIM: 0x01,
  STAR_MEDIUM: 0x02,
  STAR_BRIGHT: 0x03,
  GROUND_TOP: 0x04,
  GROUND_FILL: 0x06,
  CLOUD_LEFT: 0x08,
  CLOUD_MIDDLE: 0x0a,
  CLOUD_RIGHT: 0x0c,
  MOON: 0x0e,
  LIFE_ICON: 0x10,
  HEALTH_FULL: 0x11,
  HEALTH_HALF: 0x12,
  HEALTH_EMPTY: 0x13,
  AMMO_ICON: 0x18,
  TOKEN: 0x60,
  SPRING: 0x62,
  SPIKES: 0x64,
  GROUND_CRACKED: 0x66,
  LOGO_FIRST: 0x80,
};

export const SPRITE_TILES = {
  CLAUDE_STAND: 0x00,
  CLAUDE_WALK_1: 0x02,
  CLAUDE_WALK_2: 0x04,
  CLAUDE_JUMP: 0x06,
  BUG_WALK_1: 0x08,
  BUG_WALK_2: 0x0a,
  BUG_SQUASHED: 0x0c,
  FLY_WINGS_UP: 0x0e,
  TOKEN: 0x20,
  SPARKLE: 0x23,
  FLY_WINGS_DOWN: 0x24,
  PLATFORM: 0x26,
  BULLET: 0x2a,
  SHOCKWAVE: 0x2b,
  THROWN_STAR: 0x2c,
  KING_CROWN: 0x2d,
  KING_BUG_1: 0x40,
  KING_BUG_2: 0x44,
  SEGFAULT_1: 0x48,
  SEGFAULT_2: 0x4c,
  ICICLE: 0x80,
};

function placeRow(table, firstIndex, rows) {
  table.place(firstIndex, rows.map((row) => row.slice(0, 8)));
  table.place(firstIndex + 1, rows.map((row) => row.slice(8, 16)));
}

function buildBackgroundTable() {
  const table = new PatternTable(PIXELS);
  const t = BACKGROUND_TILES;

  table.place(t.EMPTY, Array(8).fill("........"));
  table.place(t.STAR_DIM, tiles.STAR_DIM);
  table.place(t.STAR_MEDIUM, tiles.STAR_MEDIUM);
  table.place(t.STAR_BRIGHT, tiles.STAR_BRIGHT);
  table.placeMeta(t.GROUND_TOP, tiles.GROUND_TOP);
  table.placeMeta(t.GROUND_FILL, tiles.GROUND_FILL);
  placeRow(table, t.CLOUD_LEFT, tiles.CLOUD_LEFT);
  placeRow(table, t.CLOUD_MIDDLE, tiles.CLOUD_MIDDLE);
  placeRow(table, t.CLOUD_RIGHT, tiles.CLOUD_RIGHT);
  table.placeMeta(t.MOON, tiles.MOON);
  table.place(t.LIFE_ICON, tiles.LIFE_ICON);
  table.place(t.HEALTH_FULL, tiles.HEALTH_FULL);
  table.place(t.HEALTH_HALF, tiles.HEALTH_HALF);
  table.place(t.HEALTH_EMPTY, tiles.HEALTH_EMPTY);
  table.place(t.AMMO_ICON, tiles.AMMO_ICON);
  table.placeMeta(t.TOKEN, tiles.TOKEN);
  table.placeMeta(t.SPRING, tiles.SPRING);
  table.placeMeta(t.SPIKES, tiles.SPIKES);
  table.placeMeta(t.GROUND_CRACKED, tiles.GROUND_CRACKED);

  for (const [character, glyph] of Object.entries(FONT_GLYPHS)) {
    table.place(String(character).charCodeAt(0), glyphToTile(glyph));
  }

  const logo = renderLogo(LOGO_TEXT, LOGO_SCALE);
  const { layout, tilesUsed } = placeLogo(table, logo, { firstTile: t.LOGO_FIRST, emptyTile: t.EMPTY });
  if (t.LOGO_FIRST + tilesUsed > 0x100) throw new Error(`The logo needs ${tilesUsed} tiles and does not fit`);

  return { table, logo: { layout, width: logo.tilesWide, height: logo.tilesHigh } };
}

function buildSpriteTable() {
  const table = new PatternTable(PIXELS);
  const t = SPRITE_TILES;

  table.placeMeta(t.CLAUDE_STAND, sprites.CLAUDE_STAND);
  table.placeMeta(t.CLAUDE_WALK_1, sprites.CLAUDE_WALK_1);
  table.placeMeta(t.CLAUDE_WALK_2, sprites.CLAUDE_WALK_2);
  table.placeMeta(t.CLAUDE_JUMP, sprites.CLAUDE_JUMP);
  table.placeMeta(t.BUG_WALK_1, sprites.BUG_WALK_1);
  table.placeMeta(t.BUG_WALK_2, sprites.BUG_WALK_2);
  table.placeMeta(t.BUG_SQUASHED, sprites.BUG_SQUASHED);
  table.placeMeta(t.FLY_WINGS_UP, sprites.FLY_WINGS_UP);
  table.placeMeta(t.FLY_WINGS_DOWN, sprites.FLY_WINGS_DOWN);
  table.placeMeta(t.ICICLE, sprites.ICICLE);
  // Moving clouds are 32x8 sprites: the rounded ends of the background cloud art
  placeRow(table, t.PLATFORM, tiles.CLOUD_LEFT);
  placeRow(table, t.PLATFORM + 2, tiles.CLOUD_RIGHT);
  table.place(t.BULLET, bosses.BULLET);
  table.place(t.SHOCKWAVE, bosses.SHOCKWAVE);
  table.place(t.THROWN_STAR, bosses.THROWN_STAR);
  placeRow(table, t.KING_CROWN, bosses.KING_CROWN);
  table.placeBlock(t.KING_BUG_1, bosses.KING_BUG_1);
  table.placeBlock(t.KING_BUG_2, bosses.KING_BUG_2);
  table.placeBlock(t.SEGFAULT_1, bosses.SEGFAULT_1);
  table.placeBlock(t.SEGFAULT_2, bosses.SEGFAULT_2);
  sprites.TOKEN_FRAMES.forEach((frame, index) => table.place(t.TOKEN + index, frame));
  table.place(t.SPARKLE, sprites.SPARKLE);
  return table;
}

/** One bit per non-empty 8x8 tile (row * 4 + column) of a 32x32 drawing. */
function visibleTileMask(rows) {
  let mask = 0;
  for (let tileRow = 0; tileRow < 4; tileRow++) {
    for (let tileColumn = 0; tileColumn < 4; tileColumn++) {
      const tile = rows.slice(tileRow * 8, tileRow * 8 + 8).map((row) => row.slice(tileColumn * 8, tileColumn * 8 + 8));
      if (tile.some((row) => /[abc]/.test(row))) mask |= 1 << (tileRow * 4 + tileColumn);
    }
  }
  return mask;
}

const BOSS_FRAMES = {
  KING_BUG_1: bosses.KING_BUG_1,
  KING_BUG_2: bosses.KING_BUG_2,
  SEGFAULT_1: bosses.SEGFAULT_1,
  SEGFAULT_2: bosses.SEGFAULT_2,
};

function toHex(value) {
  return `0x${value.toString(16).padStart(2, "0").toUpperCase()}`;
}

function toDefines(prefix, constants) {
  return Object.entries(constants)
    .map(([name, value]) => `#define ${prefix}${name} ${toHex(value)}`)
    .join("\n");
}

function toByteArray(bytes) {
  const lines = [];
  for (let index = 0; index < bytes.length; index += 16) {
    lines.push(`  ${bytes.slice(index, index + 16).map(toHex).join(", ")},`);
  }
  return lines.join("\n");
}

export function buildAssets() {
  const { table: background, logo } = buildBackgroundTable();
  const spriteTable = buildSpriteTable();

  const chr = new Uint8Array(CHR_BANK_SIZE);
  chr.set(background.bytes, 0);
  chr.set(spriteTable.bytes, CHR_BANK_SIZE / 2);

  const palette = [...PALETTES.background.flat(), ...PALETTES.sprites.flat()];

  const header = `// Generated by art/index.mjs - do not edit by hand
#ifndef ASSETS_H
#define ASSETS_H

${toDefines("BG_", BACKGROUND_TILES)}

${toDefines("SPR_", SPRITE_TILES)}

${Object.entries(BOSS_FRAMES)
  .map(([name, rows]) => `#define MASK_${name} 0x${visibleTileMask(rows).toString(16).toUpperCase()}`)
  .join("\n")}

#define SKY_TWINKLE_COUNT ${SKY_TWINKLE_COLORS.length}
#define LOGO_WIDTH ${logo.width}
#define LOGO_HEIGHT ${logo.height}

extern const unsigned char game_palette[32];
extern const unsigned char sky_twinkle_colors[SKY_TWINKLE_COUNT];
extern const unsigned char logo_layout[${logo.layout.length}];

#endif
`;

  const source = `// Generated by art/index.mjs - do not edit by hand
#include "assets.h"

const unsigned char game_palette[32] = {
${toByteArray(palette)}
};

const unsigned char sky_twinkle_colors[SKY_TWINKLE_COUNT] = {
${toByteArray(SKY_TWINKLE_COLORS)}
};

const unsigned char logo_layout[${logo.layout.length}] = {
${toByteArray(logo.layout)}
};
`;

  return { chr, header, source, palette, background, spriteTable };
}
