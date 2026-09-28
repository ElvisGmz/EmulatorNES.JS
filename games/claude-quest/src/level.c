#include "game.h"
#include "assets.h"

// Level legend: "." sky, "#" ground, "=" cloud (one-way platform), "P" player start,
// "o" token, "b"/"d" bug walking left/right, "f" flying bug, "S" spring, "^" ice spikes,
// "H"/"V" horizontal/vertical moving cloud (32 px wide) and ":" where moving clouds turn.
// A tapped jump reaches 2 rows up, a held one about 3.5 rows, a spring about 5.
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

static const char *const levels[LEVEL_COUNT] = {
    level_hello,  level_gaps,  level_bugs,   level_clouds,  level_final,
    level_bounce, level_train, level_spikes, level_buzzing, level_last,
};
static const char *const level_names[LEVEL_COUNT] = {
    "HELLO, WORLD", "MIND THE GAP", "BUG HUNT",     "CLOUD HOP", "FINAL PUSH",
    "BOUNCE HOUSE", "SKY TRAIN",    "SPIKE GARDEN", "BUZZING",   "THE LAST TOKEN",
};
static const u8 level_bug_speeds[LEVEL_COUNT] = {8, 8, 10, 12, 14, 14, 14, 16, 16, 18};

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
        case 'o':
          level_map[index] = CELL_TOKEN;
          token_add(x, y);
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
          } else if (symbol == 'H' || symbol == 'V') {
            platform_add(x, y, symbol == 'V');
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
