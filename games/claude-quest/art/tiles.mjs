// Background drawings. Colors refer to the background palette of each area:
// ground uses palette 0, clouds palette 1, text palette 2 and the sky palette 3.

export const GROUND_TOP = [
  "cccccccccccccccc",
  "cccccccccccccccc",
  "caccccaccccacccc",
  "abacaabacaabacaa",
  "bbbabbbbbabbbbab",
  "bbbbbbbbbbbbbbbb",
  "bbabbbbbbbbabbbb",
  "bbbbbbbabbbbbbbb",
  "bbbbbbbbbbbbbbbb",
  "babbbbbbbbabbbbb",
  "bbbbbabbbbbbbbbb",
  "bbbbbbbbbbbbbabb",
  "bbbabbbbbbbbbbbb",
  "bbbbbbbbbabbbbbb",
  "bbbbbbbbbbbbbbbb",
  "bbbbbabbbbbbbbbb",
];

export const GROUND_FILL = [
  "bbbbbbbbbbbbbbbb",
  "bbbabbbbbbbbabbb",
  "bbbbbbbbbbbbbbbb",
  "babbbbbbabbbbbbb",
  "bbbbbbbbbbbbbbab",
  "bbbbbabbbbbbbbbb",
  "bbbbbbbbbbbbbbbb",
  "bbbbbbbbbbbabbbb",
  "babbbbbbbbbbbbbb",
  "bbbbbbbbbbbbbbbb",
  "bbbbbabbbbbbbbab",
  "bbbbbbbbbbbbbbbb",
  "bbbbbbbbbabbbbbb",
  "bbabbbbbbbbbbbbb",
  "bbbbbbbbbbbbbbbb",
  "bbbbbbabbbbbbbbb",
];

// Ground about to fall away in a troll level: the sky shows through the cracks
export const GROUND_CRACKED = [
  "ccccc.cccccc.ccc",
  "cccc.cccccc..ccc",
  "caca.caccc.accc.",
  "aba.aabaca.bacaa",
  "bb.abbbbb.bbbbab",
  "bb.bbbbbb.bbbbbb",
  "bba.bbbbb.babbbb",
  "bbb.bbbba.bbbbbb",
  "bbbb.bbbb.bbbbbb",
  "babb.bbbb.abbbbb",
  "bbbbb.bbbb.bbbbb",
  "bbbbb.bbbb.bbabb",
  "bbbabb.bbbb.bbbb",
  "bbbbbb.bbbb.bbbb",
  "bbbbbbb.bbbb.bbb",
  "bbbbbab.bbbbb.bb",
];

export const CLOUD_MIDDLE = [
  "...cc......cc...",
  ".cccccc..cccccc.",
  "cccccccccccccccc",
  "cccccccccccccccc",
  "cccccccccccccccc",
  "bbccbbbbccbbbbcc",
  "bbbbbbbbbbbbbbbb",
  "aabbaaaabbaaaabb",
];

export const CLOUD_LEFT = [
  "................",
  "....cccc..cccccc",
  "..cccccccccccccc",
  ".ccccccccccccccc",
  ".ccccccccccccccc",
  "..bbccbbbbccbbbb",
  "...bbbbbbbbbbbbb",
  ".....aaabbaaaabb",
];

export const CLOUD_RIGHT = CLOUD_LEFT.map((row) => [...row].reverse().join(""));

// Sky palette: a = gold, b = pale yellow, c = white (c is cycled at runtime so everything twinkles)
export const STAR_DIM = ["........", "........", "...a....", "..aba...", "...a....", "........", "........", "........"];
export const STAR_MEDIUM = ["........", "...a....", "...b....", ".abcba..", "...b....", "...a....", "........", "........"];
export const STAR_BRIGHT = ["...a....", ".a.b.a..", "..bcb...", "abcccba.", "..bcb...", ".a.b.a..", "...a....", "........"];

const mirrorRow = (half) => half + [...half].reverse().join("");
const TOKEN_TOP_LEFT = ["........", ".......a", "......ab", "......ab", ".....abb", "..aaabbc", ".abbbbcc", "abbbcccc"];

/** The collectible token: a chunky four-point star drawn with the sky palette, mirrored both ways. */
export const TOKEN = [...TOKEN_TOP_LEFT, ...[...TOKEN_TOP_LEFT].reverse()].map(mirrorRow);

// Spring pad drawn with the ground palette: a = dark soil, b = soil, c = grass green
export const SPRING = [
  "................",
  "...cccccccccc...",
  "..cccccccccccc..",
  ".cccccccccccccc.",
  ".aaaaaaaaaaaaaa.",
  "....abbbbbba....",
  "...abaaaaaaba...",
  "....abbbbbba....",
  "...abaaaaaaba...",
  "....abbbbbba....",
  "...abaaaaaaba...",
  "....abbbbbba....",
  "...abaaaaaaba...",
  "..aaaaaaaaaaaa..",
  ".abbbbbbbbbbbba.",
  ".aaaaaaaaaaaaaa.",
];

const SPIKE = ["....", "....", "....", "....", "....", "....", "....", ".c..", ".c..", ".ca.", ".ca.", "cba.", "cbaa", "cbaa", "cbaa", "aaaa"];

/** Four ice spikes in the bottom half of the cell, drawn with the cloud palette (a = blue, b = pale, c = white). */
export const SPIKES = SPIKE.map((row) => row.repeat(4));

export const MOON = [
  "......bbbb......",
  "....bbbbbbbb....",
  "...bbcbbbbbbb...",
  "..bbcbbbbbabbb..",
  "..bcbbbbbaaabb..",
  ".bbcbbbbbbabbbb.",
  ".bcbbbbbbbbbbbb.",
  ".bbbbbabbbbbbbb.",
  ".bbbbaaabbbbbbb.",
  ".bbbbbabbbbbabb.",
  ".bbbbbbbbbbaaab.",
  "..bbbbbbbbbbabb.",
  "..bbbbbbbbbbbb..",
  "...bbbbbbbbbb...",
  "....bbbbbbbb....",
  "......bbbb......",
];

// Boss health bar segments and the star ammo icon, drawn with the text palette
export const HEALTH_FULL = ["cccccccc", "aaaaaaaa", "bbbbbbbb", "bbbbbbbb", "bbbbbbbb", "bbbbbbbb", "cccccccc", "........"];
export const HEALTH_HALF = ["cccccccc", "aaaacccc", "bbbbcccc", "bbbbcccc", "bbbbcccc", "bbbbcccc", "cccccccc", "........"];
export const HEALTH_EMPTY = ["cccccccc", "cccccccc", "cccccccc", "cccccccc", "cccccccc", "cccccccc", "cccccccc", "........"];
export const AMMO_ICON = ["...b....", "...b....", "..bab...", "bbaaabb.", "..bab...", "...b....", "...b....", "........"];

// Life icon for the HUD, drawn with the text palette (a = white, b = orange, c = black)
export const LIFE_ICON = ["...aa...", "...cc...", ".cccccc.", "cbbbbbbc", "cbcbbcbc", "cbbbbbbc", ".cccccc.", "..c..c.."];
