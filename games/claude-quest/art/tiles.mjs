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

export const STAR_DIM = ["........", "........", "........", "...a....", "........", "........", "........", "........"];
export const STAR_MEDIUM = ["........", "........", "...a....", "..aca...", "...a....", "........", "........", "........"];
export const STAR_BRIGHT = ["........", "...a....", "...c....", ".accca..", "...c....", "...a....", "........", "........"];

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

// Life icon for the HUD, drawn with the text palette (a = white, b = orange, c = black)
export const LIFE_ICON = ["...aa...", "...cc...", ".cccccc.", "cbbbbbbc", "cbcbbcbc", "cbbbbbbc", ".cccccc.", "..c..c.."];
