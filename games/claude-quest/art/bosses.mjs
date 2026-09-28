// Boss art: 32x32 metasprites (4x4 tiles). Same palette letters as the other sprites.
import { BUG_WALK_1, BUG_WALK_2 } from "./sprites.mjs";

const SIZE = 32;
const EMPTY_ROW = ".".repeat(SIZE);

// The bug frames use rows 4-14; doubled, they fill the bottom 22 rows of the 32x32 sprite
const BUG_FIRST_ROW = 4;
const BUG_LAST_ROW = 14;

function doublePixels(rows) {
  return rows.flatMap((row) => {
    const wide = [...row].map((pixel) => pixel + pixel).join("");
    return [wide, wide];
  });
}

/** King Bug: the regular bug at twice the size, standing on the bottom edge (bug palette). */
function kingBug(bugFrame) {
  const body = doublePixels(bugFrame.slice(BUG_FIRST_ROW, BUG_LAST_ROW + 1));
  return [...Array(SIZE - body.length).fill(EMPTY_ROW), ...body];
}

export const KING_BUG_1 = kingBug(BUG_WALK_1);
export const KING_BUG_2 = kingBug(BUG_WALK_2);

// Golden crown drawn as a separate 16x8 sprite on top of the shell (sparkle palette:
// a = orange, b = yellow, c = white jewels)
export const KING_CROWN = [
  "b...b...b.......",
  "bab.bab.bab.....",
  "babbbabbbab.....",
  "bbbbbbbbbbb.....",
  "bcbbbcbbbcb.....",
  "aaaaaaaaaaa.....",
  "................",
  "................",
];

/**
 * The Segfault: a ghost with one big eye whose rows glitch sideways (moving-cloud
 * palette: a = purple, b = lavender, c = white). `frame` moves the pupil and the glitch.
 */
function segfault(frame) {
  const glitchRows = frame === 0 ? { 9: 2, 10: 2, 21: -2 } : { 6: -2, 17: 3, 18: 3 };
  const pupilOffset = frame === 0 ? -2 : 2;

  const pixelAt = (x, y) => {
    const bodyDistance = Math.hypot(x - 15.5, y - 13);
    const skirtBottom = 27 + ((Math.floor(x / 4) + frame) % 2 === 0 ? 2 : 0);
    const inBody = bodyDistance <= 13 || (y >= 13 && y <= skirtBottom && x >= 3 && x <= 28);
    if (!inBody) return ".";

    const edge = bodyDistance > 12 && y < 13;
    const skirtEdge = y >= 13 && (x === 3 || x === 28 || y === skirtBottom);
    if (edge || skirtEdge) return "a";

    const eyeDistance = Math.hypot(x - 15.5, y - 12);
    if (eyeDistance <= 3 && Math.hypot(x - 15.5 - pupilOffset, y - 12.5) <= 2.5) return "a";
    if (eyeDistance <= 6.5) return "c";
    return "b";
  };

  return Array.from({ length: SIZE }, (_, y) => {
    const row = Array.from({ length: SIZE }, (_, x) => pixelAt(x, y)).join("");
    const shift = glitchRows[y] ?? 0;
    if (shift > 0) return ".".repeat(shift) + row.slice(0, SIZE - shift);
    if (shift < 0) return row.slice(-shift) + ".".repeat(-shift);
    return row;
  });
}

export const SEGFAULT_1 = segfault(0);
export const SEGFAULT_2 = segfault(1);

// Boss bullet: a glowing orb (sparkle palette: a = orange, b = yellow, c = white)
export const BULLET = ["..aaaa..", ".abbbba.", "abbccbba", "abccccba", "abccccba", "abbccbba", ".abbbba.", "..aaaa.."];

// King Bug's ground shockwave (moving-cloud palette)
export const SHOCKWAVE = ["........", "........", "...c....", "..cbc...", ".cbabc..", "cbaaabc.", "baaaaab.", "aaaaaaaa"];

// Star thrown by Claude (sparkle palette)
export const THROWN_STAR = ["...c....", "...c....", "..cbc...", "ccbabcc.", "..cbc...", "...c....", "...c....", "........"];
