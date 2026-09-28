// Sprite drawings. "." is transparent and a/b/c are colors 1-3 of the sprite
// palette each one uses (see PALETTES in index.mjs).

const CLAUDE_HEAD = [
  ".......cc.......",
  "......cbbc......",
  ".......aa.......",
  "...aaaaaaaaaa...",
  "..abbbbbbbbbba..",
  "..abccbbbbbbba..",
];

const CLAUDE_BODY = [
  "aaabcbbbbbbbbaaa",
  "abbbbbabbabbbbba",
  "aaabbbabbabbbaaa",
  "..abbbbbbbbbba..",
  "..abbbbbbbbbba..",
  "...aaaaaaaaaa...",
];

export const CLAUDE_STAND = [
  "................",
  ...CLAUDE_HEAD,
  ...CLAUDE_BODY,
  "...ab.ab..ba.ba.",
  "...aa.aa..aa.aa.",
  "................",
];

export const CLAUDE_WALK_1 = [
  "................",
  ...CLAUDE_HEAD,
  ...CLAUDE_BODY,
  "..ab..ab..ba..ba",
  "..aa..aa..aa..aa",
  "................",
];

export const CLAUDE_WALK_2 = [
  "................",
  ...CLAUDE_HEAD,
  ...CLAUDE_BODY,
  "....abab..baba..",
  "....aaaa..aaaa..",
  "................",
];

export const CLAUDE_JUMP = [
  "......c..c......",
  ".......cc.......",
  "......cbbc......",
  ".......aa.......",
  "a..aaaaaaaaaa..a",
  "ab.abbbbbbbbba.b",
  "abaabccbbbbbbaba",
  ".abbcbabbabbbba.",
  "..abbbabbabbba..",
  "..abbbbbbbbbba..",
  "..abbbbbbbbbba..",
  "...aaaaaaaaaa...",
  "...ab.ab..ba.ba.",
  "..ab..ab..ba..ba",
  "..aa..aa..aa..aa",
  "................",
];

export const BUG_WALK_1 = [
  "................",
  "................",
  "................",
  "................",
  "..a.............",
  "...a..aaaaaa....",
  "...aaabbbbbbaa..",
  "..abcabbbbbbbba.",
  ".abbbbbbcbbbbbba",
  ".abbbbbbcbbbbbba",
  ".abbbbbbcbbbbbba",
  "..aaaabbcbbbbba.",
  "....aaaaaaaaaa..",
  "....a.a..a.a....",
  "...a..a.a..a....",
  "................",
];

export const BUG_WALK_2 = [
  ...BUG_WALK_1.slice(0, 13),
  "....a.a..a.a....",
  ".....a.a..a.a...",
  "................",
];

export const BUG_SQUASHED = [
  ...Array(11).fill("................"),
  "................",
  "...aaaaaaaaaa...",
  "..abcabbbcbbbba.",
  ".abbbbbbbcbbbbba",
  ".aaaaaaaaaaaaaa.",
];

const FLY_BODY = [
  "..a....c.c......",
  "...a..aaaaaa....",
  "...aaabbbbbbaa..",
  "..abcabbbbbbbba.",
  ".abbbbbbcbbbbbba",
  ".abbbbbbcbbbbbba",
  "..aaaabbcbbbbba.",
  "....aaaaaaaaaa..",
];

export const FLY_WINGS_UP = [
  "......c...c.....",
  ".....ccc.ccc....",
  ".....ccc.ccc....",
  "......cc.cc.....",
  ...FLY_BODY,
  "................",
  "................",
  "................",
  "................",
];

export const FLY_WINGS_DOWN = [
  "................",
  "................",
  "................",
  "................",
  ...FLY_BODY.map((row, index) => (index === 0 ? "..a............." : row)),
  "....ccc..ccc....",
  ".....cc...cc....",
  "................",
  "................",
];

// Icicle that drops from the ceiling in troll levels (moving cloud palette: purple, lavender, white)
export const ICICLE = [
  "..aaaaaaaaaaaa..",
  "..abbcccbbbbba..",
  "...abcbbbbbba...",
  "...abcbbbbbba...",
  "....abcbbbba....",
  "....abcbbbba....",
  "....abcbbbba....",
  ".....abcbba.....",
  ".....abcbba.....",
  ".....abcbba.....",
  "......acba......",
  "......acba......",
  "......abba......",
  ".......ca.......",
  ".......ba.......",
  ".......a........",
];

// Decorative sparkles for the title and ending screens (tokens in levels are background tiles)
export const TOKEN_FRAMES = [
  ["...b....", "...c....", "..bcb...", "bcccccb.", "..bcb...", "...c....", "...b....", "........"],
  ["........", "...b....", "...c....", ".bcccb..", "...c....", "...b....", "........", "........"],
  ["........", "........", "...b....", "..bcb...", "...b....", "........", "........", "........"],
];

export const SPARKLE = ["........", "..b.b...", "...c....", ".bcacb..", "...c....", "..b.b...", "........", "........"];
