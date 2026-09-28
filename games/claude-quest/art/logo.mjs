import { splitIntoTiles } from "../tools/chr.mjs";
import { FONT_GLYPHS, isGlyphPixel } from "./font.mjs";

const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;
const SHADOW_OFFSET = 2;

function roundUpToTile(pixels) {
  return Math.ceil(pixels / 8) * 8;
}

/**
 * Renders big text by scaling the 5x7 font: orange letters with a white top
 * highlight and a black drop shadow (text palette: a = white, b = orange, c = black).
 */
export function renderLogo(text, scale) {
  const letterWidth = GLYPH_WIDTH * scale;
  const spacing = scale;
  const textWidth = text.length * letterWidth + (text.length - 1) * spacing + SHADOW_OFFSET;
  const textHeight = GLYPH_HEIGHT * scale + SHADOW_OFFSET;
  const width = roundUpToTile(textWidth);
  const height = roundUpToTile(textHeight);
  const offsetX = Math.floor((width - textWidth) / 2);
  const offsetY = Math.floor((height - textHeight) / 2);

  const isInk = (x, y) => {
    const localX = x - offsetX;
    const localY = y - offsetY;
    if (localX < 0 || localY < 0) return false;
    const letterIndex = Math.floor(localX / (letterWidth + spacing));
    const letterX = localX - letterIndex * (letterWidth + spacing);
    if (letterIndex >= text.length || letterX >= letterWidth) return false;
    return isGlyphPixel(FONT_GLYPHS[text[letterIndex]], Math.floor(letterX / scale), Math.floor(localY / scale));
  };

  const rows = [];
  for (let y = 0; y < height; y++) {
    let row = "";
    for (let x = 0; x < width; x++) {
      if (isInk(x, y)) row += isInk(x, y - scale) ? "b" : y % scale === 0 ? "a" : "b";
      else if (isInk(x - SHADOW_OFFSET, y - SHADOW_OFFSET)) row += "c";
      else row += ".";
    }
    rows.push(row);
  }
  return { rows, tilesWide: width / 8, tilesHigh: height / 8 };
}

/** Deduplicates the logo tiles into the pattern table and returns its nametable layout. */
export function placeLogo(table, logo, { firstTile, emptyTile }) {
  const layout = [];
  const tileIndexByKey = new Map();
  let nextTile = firstTile;

  for (const tile of splitIntoTiles(logo.rows)) {
    const key = tile.join("");
    if (!/[abc]/.test(key)) {
      layout.push(emptyTile);
      continue;
    }
    if (!tileIndexByKey.has(key)) {
      table.place(nextTile, tile);
      tileIndexByKey.set(key, nextTile++);
    }
    layout.push(tileIndexByKey.get(key));
  }
  return { layout, tilesUsed: nextTile - firstTile };
}
