#include "game.h"
#include "assets.h"

// Level legend: "." sky, "#" ground, "=" cloud (one-way platform), "P" player start, "X" boss,
// "o" token, "b"/"d" bug walking left/right, "f" flying bug, "S" spring, "^" ice spikes,
// "H"/"V" horizontal/vertical moving cloud (32 px wide) and ":" where moving clouds turn.
// A tapped jump reaches 2 rows up, a held one about 3.5 rows, a spring about 5.
//
// Troll pieces look like ordinary level parts (or like nothing) until Claude gets close:
// "%" ground that cracks and falls away (with the ground below it), "!" hidden ice spikes,
// "Y" a hidden icicle that drops from the ceiling, "h" a moving cloud that darts away from
// Claude's first jump, "O" a token that runs away to "1", then "2" and "3", and "?" hidden
// tokens that appear after a fake "LEVEL CLEAR!".
static const char level_hello[] =
    "................"
    "................"
    ".......oo......."
    "......====......"
    "..o..........o.."
    ".====......====."
    "................"
    "......====......"
    "..o..........o.."
    ".====......====."
    "..P.....o....b.."
    "################"
    "################";

static const char level_gaps[] =
    "................"
    "................"
    "................"
    "................"
    "......o..o......"
    ".....======....."
    ".o............o."
    "===..........==="
    "....o......o...."
    "...===....===..."
    ".P....o..o....b."
    "#####..##..#####"
    "#####..##..#####";

static const char level_bugs[] =
    "................"
    "................"
    ".o............o."
    "====........===="
    ".....o.b..o....."
    "....========...."
    ".o............o."
    "===..........==="
    "......o.b..o...."
    ".....========..."
    ".P.........b...."
    "################"
    "################";

static const char level_clouds[] =
    "................"
    "................"
    "................"
    "................"
    "......o..o......"
    ".....======....."
    "..o..........o.."
    ".===........===."
    "......o..o......"
    "....===..===...."
    ".P............b."
    "###..........###"
    "###..........###";

static const char level_final[] =
    "................"
    "................"
    "......o..o......"
    ".....======....."
    "..o.b......b.o.."
    ".=====....=====."
    "......o.b.o....."
    ".....======....."
    ".o............o."
    "===..........==="
    ".P...o....o...b."
    "####..####..####"
    "####..####..####";

// Troll levels, disguised as ordinary easy levels: the ground falls away under Claude
static const char level_solid_ground[] =
    "................"
    "................"
    "................"
    "................"
    "......o..o......"
    ".....======....."
    "....o.....o....."
    "..o..........o.."
    ".===........===."
    "................"
    ".P.....o....o.b."
    "###%%%###%%%####"
    "###%%%###%%%####";

// Spikes pop out of flat ground, and the star at the top runs back to the start
static const char level_safe_mode[] =
    "................"
    "................"
    "....1......O...."
    "...====..====..."
    "................"
    ".o............o."
    "===....==....==="
    "................"
    "....o......o...."
    "...===....===..."
    ".P2...!o.!o...b."
    "################"
    "################";

// Hard levels: they mix springs, spikes, flying bugs and moving clouds

static const char level_bounce[] =
    "................"
    "................"
    "..o.........o..."
    ".===.......===.."
    "................"
    "......o..o......"
    ".....======....."
    "................"
    "........f......."
    ".o............o."
    ".PS.^^.S..^^.S.."
    "################"
    "################";

static const char level_train[] =
    "................"
    "................"
    "................"
    "......o..o......"
    "....:H......:..."
    "..........f....."
    "..o..........o.."
    ".===........===."
    "........o......."
    "...:H.......:..."
    ".P............o."
    "###..........###"
    "###..........###";

// The same ride as Sky Train, except the low cloud dodges and an icicle waits on the far side
static const char level_sky_train_2[] =
    "................"
    "................"
    "................"
    "......o..o......"
    "....:H......:..."
    "..........f....."
    "..o..........o.."
    ".===........===."
    "........o....Y.."
    "...:h.......:..."
    ".P............o."
    "###..........###"
    "###..........###";

static const char level_spikes[] =
    "................"
    "................"
    "...o........o..."
    "..===......===.."
    "................"
    ".......oo......."
    "......====......"
    "................"
    ".o..b......b..o."
    "=======..======="
    ".P..^^..o..^^..."
    "################"
    "################";

static const char level_buzzing[] =
    "................"
    "................"
    ".o............o."
    "===..........==="
    "......:..:......"
    "..f..........f.."
    "......o..o......"
    "................"
    "...o........o..."
    "......V..V......"
    ".P............o."
    "######:..:######"
    "######....######";

// Icicles under the big cloud, a spike on it, and a pit right after the spikes you jump
static const char level_stable_release[] =
    "................"
    "................"
    "..o..........o.."
    ".===........===."
    "................"
    "......o.!o......"
    ".....======....."
    "......Y..Y......"
    "................"
    "..o..........o.."
    ".PS......^^..S.."
    "###########%%###"
    "###########%%###";

// Four tokens, a fake clear, then four more (with a spike just past the top-left one)
static const char level_almost_done[] =
    "................"
    "................"
    ".!?..........?.."
    ".===........===."
    "........f......."
    "......o..o......"
    ".....======....."
    "................"
    ".o............o."
    "===..........==="
    ".P....?..?....d."
    "####%%####%%####"
    "####%%####%%####";

static const char level_last[] =
    "................"
    "................"
    ".......oo......."
    "......====......"
    "..o...........o."
    ".===.:H....:.==="
    "........f......."
    "................"
    ".o....o..o....o."
    "===..S....S..==="
    ".P.....b.....d.."
    "####^^####^^####"
    "####..####..####";

// Boss arenas: the tokens here are star ammo that grows back (throw them with B)

static const char arena_king_bug[] =
    "................"
    "................"
    "................"
    "................"
    "................"
    "................"
    "................"
    "................"
    "...o........o..."
    "..===......===.."
    ".P.....oo.....X."
    "################"
    "################";

static const char arena_segfault[] =
    "................"
    "................"
    "................"
    "......X........."
    "................"
    "................"
    "..o..........o.."
    ".===........===."
    "................"
    "....==....==...."
    ".P....o..o......"
    "################"
    "################";

// Troll levels sit among the others and are numbered and named like any other level
static const char *const levels[LEVEL_COUNT] = {
    level_hello,          level_gaps,    level_solid_ground, level_bugs,          level_clouds,
    level_safe_mode,      level_final,   arena_king_bug,     level_bounce,        level_train,
    level_sky_train_2,    level_spikes,  level_stable_release, level_buzzing,     level_almost_done,
    level_last,           arena_segfault,
};
static const char *const level_names[LEVEL_COUNT] = {
    "HELLO, WORLD", "MIND THE GAP", "SOLID GROUND",   "BUG HUNT",     "CLOUD HOP",      "SAFE MODE",
    "FINAL PUSH",   "KING BUG",     "BOUNCE HOUSE",   "SKY TRAIN",    "SKY TRAIN II",   "SPIKE GARDEN",
    "STABLE RELEASE", "BUZZING",    "ALMOST DONE",    "THE LAST TOKEN", "THE SEGFAULT",
};
// Number shown in the HUD and intro; 0 marks a boss arena
static const u8 level_numbers[LEVEL_COUNT] = {1, 2, 3, 4, 5, 6, 7, 0, 8, 9, 10, 11, 12, 13, 14, 15, 0};
static const u8 level_bosses[LEVEL_COUNT] = {
    BOSS_NONE, BOSS_NONE, BOSS_NONE, BOSS_NONE, BOSS_NONE, BOSS_NONE, BOSS_NONE, BOSS_KING_BUG, BOSS_NONE,
    BOSS_NONE, BOSS_NONE, BOSS_NONE, BOSS_NONE, BOSS_NONE, BOSS_NONE, BOSS_NONE, BOSS_SEGFAULT,
};
// Dying in a troll level costs no life: the level starts over and the HUD counts it
static const u8 level_trolls[LEVEL_COUNT] = {0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0};
static const u8 level_bug_speeds[LEVEL_COUNT] = {8, 8, 8, 10, 12, 12, 14, 16, 14, 14, 14, 16, 16, 16, 16, 18, 20};

#define MOON_ROW 3
#define MOON_COLUMN 13
#define TEXT_ROWS_IN_LEVELS 0x0007

u8 level_map[MAP_COLUMNS * MAP_ROWS];
u8 current_level;
u8 player_start_x;
u8 player_start_y;
u8 bug_speed;

// Map rows whose empty cells use the text palette instead of the starry sky
static u16 text_rows;

static u8 row;
static u8 column;
static u8 cell;
static u8 index;
static u8 tiles[64];
static u8 attributes[64];

u8 cell_at(u8 x, u8 y) {
  if (y >= MAP_ROWS * CELL_SIZE) return CELL_EMPTY;
  return level_map[(y & 0xF0) | (x >> 4)];
}

u8 cell_is_floor(u8 cell_type) {
  return cell_type == CELL_SOLID || cell_type == CELL_CLOUD || cell_type == CELL_SPRING;
}

/** Draws a token back (boss arenas regrow their star ammo). */
void level_draw_token_cell(u8 x, u8 y) {
  static const u8 top_tiles[2] = {BG_TOKEN, BG_TOKEN + 1};
  static const u8 bottom_tiles[2] = {BG_TOKEN + 16, BG_TOKEN + 17};
  u8 column_tile = (x >> 4) << 1;
  u8 row_tile = (y >> 4) << 1;

  level_map[(y & 0xF0) | (x >> 4)] = CELL_TOKEN;
  vram_queue_bytes(NAMETABLE_ADDR(column_tile, row_tile), top_tiles, 2);
  vram_queue_bytes(NAMETABLE_ADDR(column_tile, row_tile + 1), bottom_tiles, 2);
}

/** Clears a collected token: back to empty sky in the map and, next frame, on screen. */
void level_erase_cell(u8 x, u8 y) {
  static const u8 empty_tiles[2] = {BG_EMPTY, BG_EMPTY};
  u8 column_tile = (x >> 4) << 1;
  u8 row_tile = (y >> 4) << 1;

  level_map[(y & 0xF0) | (x >> 4)] = CELL_EMPTY;
  vram_queue_bytes(NAMETABLE_ADDR(column_tile, row_tile), empty_tiles, 2);
  vram_queue_bytes(NAMETABLE_ADDR(column_tile, row_tile + 1), empty_tiles, 2);
}

const char *level_name(u8 level) {
  return level_names[level];
}

u8 level_number(u8 level) {
  return level_numbers[level];
}

u8 level_boss(u8 level) {
  return level_bosses[level];
}

u8 level_is_troll(u8 level) {
  return level_trolls[level];
}

void level_load(u8 level) {
  const char *source = levels[level];
  char symbol;
  u8 x;
  u8 y;

  current_level = level;
  bug_speed = level_bug_speeds[level];
  text_rows = TEXT_ROWS_IN_LEVELS;
  bugs_reset();
  tokens_reset();
  platforms_reset();
  traps_reset();

  for (index = 0; index < LEVEL_FIRST_ROW * MAP_COLUMNS; ++index) level_map[index] = CELL_EMPTY;

  for (row = 0; row < LEVEL_ROWS; ++row) {
    for (column = 0; column < MAP_COLUMNS; ++column) {
      symbol = *source++;
      index = ((row + LEVEL_FIRST_ROW) << 4) | column;
      x = column << 4;
      y = (row + LEVEL_FIRST_ROW) << 4;
      switch (symbol) {
        case '#':
          level_map[index] = CELL_SOLID;
          break;
        case '=':
          level_map[index] = CELL_CLOUD;
          break;
        case 'S':
          level_map[index] = CELL_SPRING;
          break;
        case '^':
          level_map[index] = CELL_SPIKES;
          break;
        case ':':
          level_map[index] = CELL_MARKER;
          break;
        case '%':
          level_map[index] = CELL_SOLID;
          // A column of "%" falls as one piece, so only its top cell is a trap
          if (row == 0 || source[-1 - MAP_COLUMNS] != '%') trap_add(TRAP_CRUMBLE, x, y);
          break;
        case 'o':
        case 'O':
          level_map[index] = CELL_TOKEN;
          token_add(x, y);
          if (symbol == 'O') token_make_runaway();
          break;
        case '?':
          // After the fake clear has played, a retry shows every token from the start
          if (encore_played) {
            level_map[index] = CELL_TOKEN;
            token_add(x, y);
          } else {
            level_map[index] = CELL_EMPTY;
            token_add_hidden(x, y);
          }
          break;
        default:
          level_map[index] = CELL_EMPTY;
          if (symbol == 'P') {
            player_start_x = x;
            player_start_y = y;
          } else if (symbol == 'b' || symbol == 'd') {
            bug_add(x, y, symbol == 'b', 0);
          } else if (symbol == 'f') {
            bug_add(x, y, 1, 1);
          } else if (symbol == 'H' || symbol == 'V' || symbol == 'h') {
            platform_add(x, y, symbol == 'V', symbol == 'h');
          } else if (symbol == '!') {
            trap_add(TRAP_SPIKES, x, y);
          } else if (symbol == 'Y') {
            icicle_add(x, y);
          } else if (symbol >= '1' && symbol <= '3') {
            token_add_runaway_spot(symbol - '1', x, y);
          } else if (symbol == 'X') {
            boss_spawn(level_bosses[level], x);
          }
      }
    }
  }
}

/**
 * Draws a starry sky with solid ground from `ground_row` down, for the title and ending
 * screens. Rows set in `text_row_mask` get the text palette and no stars. Rendering must be off.
 */
void sky_draw(u8 ground_row, u16 text_row_mask) {
  for (index = 0; index < MAP_COLUMNS * MAP_ROWS; ++index) {
    level_map[index] = (index >> 4) >= ground_row ? CELL_SOLID : CELL_EMPTY;
  }
  text_rows = text_row_mask;
  level_draw();
}

// Palette bits for each quadrant of an attribute byte: [palette][quadrant]
static const u8 attribute_bits[4][4] = {
    {0x00, 0x00, 0x00, 0x00},
    {0x01, 0x04, 0x10, 0x40},
    {0x02, 0x08, 0x20, 0x80},
    {0x03, 0x0C, 0x30, 0xC0},
};

static u8 row_is_text;
static u8 star_seed;

static u8 cell_palette(void) {
  if (cell == CELL_SOLID || cell == CELL_SPRING) return PALETTE_GROUND;
  if (cell == CELL_CLOUD || cell == CELL_SPIKES) return PALETTE_CLOUD;
  return row_is_text ? PALETTE_TEXT : PALETTE_SKY;
}

static void metatile(u8 tile_index, u8 base) {
  tiles[tile_index] = base;
  tiles[tile_index + 1] = base + 1;
  tiles[tile_index + 32] = base + 16;
  tiles[tile_index + 33] = base + 17;
}

static void cell_tiles(void) {
  u8 base;
  u8 tile_index = column << 1;

  // Cheap pseudo-random sequence (x * 5 + 1) so stars look scattered without multiplying
  star_seed = (star_seed << 2) + star_seed + 1;

  tiles[tile_index] = BG_EMPTY;
  tiles[tile_index + 1] = BG_EMPTY;
  tiles[tile_index + 32] = BG_EMPTY;
  tiles[tile_index + 33] = BG_EMPTY;

  if (cell == CELL_SOLID) {
    metatile(tile_index, (row > 0 && level_map[index - MAP_COLUMNS] == CELL_SOLID) ? BG_GROUND_FILL : BG_GROUND_TOP);
    return;
  }
  if (cell == CELL_TOKEN) {
    metatile(tile_index, BG_TOKEN);
    return;
  }
  if (cell == CELL_SPRING) {
    metatile(tile_index, BG_SPRING);
    return;
  }
  if (cell == CELL_SPIKES) {
    metatile(tile_index, BG_SPIKES);
    return;
  }

  if (cell == CELL_CLOUD) {
    base = BG_CLOUD_MIDDLE;
    if (column == 0 || level_map[index - 1] != CELL_CLOUD) base = BG_CLOUD_LEFT;
    else if (column == MAP_COLUMNS - 1 || level_map[index + 1] != CELL_CLOUD) base = BG_CLOUD_RIGHT;
    tiles[tile_index] = base;
    tiles[tile_index + 1] = base + 1;
    return;
  }

  if (row_is_text) return;

  if (row == MOON_ROW && column == MOON_COLUMN) {
    metatile(tile_index, BG_MOON);
    return;
  }

  if ((star_seed & 0x70) == 0) {
    base = star_seed >> 7;
    tiles[tile_index + (star_seed & 1) + ((star_seed & 2) << 4)] = BG_STAR_DIM + base + ((star_seed >> 3) & 1);
  }
}

/** Writes the whole nametable and attribute table. Rendering must be off. */
void level_draw(void) {
  u8 attribute_row;
  u8 quadrant_row;
  u16 row_bit = 1;

  for (index = 0; index < 64; ++index) attributes[index] = 0;
  star_seed = current_level * 37;
  index = 0;

  for (row = 0; row < MAP_ROWS; ++row) {
    row_is_text = (text_rows & row_bit) != 0;
    row_bit <<= 1;
    attribute_row = (row >> 1) << 3;
    quadrant_row = (row & 1) << 1;

    for (column = 0; column < MAP_COLUMNS; ++column) {
      cell = level_map[index];
      cell_tiles();
      attributes[attribute_row + (column >> 1)] |= attribute_bits[cell_palette()][quadrant_row + (column & 1)];
      ++index;
    }
    vram_address(NAMETABLE_ADDR(0, row << 1));
    vram_write(tiles, 64);
  }

  vram_address(ATTRIBUTE_TABLE_A);
  vram_write(attributes, 64);
}

static void queue_cell_tiles(void) {
  u8 tile_index = column << 1;
  vram_queue_bytes(NAMETABLE_ADDR(tile_index, row << 1), &tiles[tile_index], 2);
  vram_queue_bytes(NAMETABLE_ADDR(tile_index, (row << 1) + 1), &tiles[tile_index + 32], 2);
}

/**
 * Turns a cell into another type while the game runs (a trap springing), redrawing it and
 * its palette next frame. Queues 14 bytes of VRAM writes.
 */
void level_set_cell(u8 x, u8 y, u8 type) {
  u8 quadrant;
  u8 attribute_index;

  row = y >> 4;
  column = x >> 4;
  index = (row << 4) | column;
  cell = type;
  level_map[index] = type;
  row_is_text = (text_rows >> row) & 1;
  cell_tiles();
  queue_cell_tiles();

  quadrant = ((row & 1) << 1) + (column & 1);
  attribute_index = ((row >> 1) << 3) + (column >> 1);
  attributes[attribute_index] =
      (attributes[attribute_index] & ~attribute_bits[3][quadrant]) | attribute_bits[cell_palette()][quadrant];
  vram_queue_bytes(ATTRIBUTE_TABLE_A + attribute_index, &attributes[attribute_index], 1);
}

/** Draws cracks on a ground cell that is about to fall away. Queues 10 bytes of VRAM writes. */
void level_draw_cracked_cell(u8 x, u8 y) {
  row = y >> 4;
  column = x >> 4;
  metatile(column << 1, BG_GROUND_CRACKED);
  queue_cell_tiles();
}
