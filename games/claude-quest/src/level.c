#include "game.h"
#include "assets.h"

// Level legend: "." sky, "#" ground, "=" cloud (one-way platform), "P" player start,
// "o" token, "b" bug walking left, "d" bug walking right. Each row is 16 cells and a
// jump reaches 2 rows up, so every platform is at most 2 rows above the previous one.
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
    "o..............o"
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

static const char *const levels[LEVEL_COUNT] = {level_hello, level_gaps, level_bugs, level_clouds, level_final};
static const char *const level_names[LEVEL_COUNT] = {"HELLO, WORLD", "MIND THE GAP", "BUG HUNT", "CLOUD HOP", "FINAL PUSH"};
static const u8 level_bug_speeds[LEVEL_COUNT] = {8, 8, 10, 12, 14};

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

  for (index = 0; index < LEVEL_FIRST_ROW * MAP_COLUMNS; ++index) level_map[index] = CELL_EMPTY;

  for (row = 0; row < LEVEL_ROWS; ++row) {
    for (column = 0; column < MAP_COLUMNS; ++column) {
      symbol = *source++;
      index = ((row + LEVEL_FIRST_ROW) << 4) | column;
      x = column << 4;
      y = (row + LEVEL_FIRST_ROW) << 4;
      level_map[index] = symbol == '#' ? CELL_SOLID : symbol == '=' ? CELL_CLOUD : CELL_EMPTY;

      if (symbol == 'P') {
        player_start_x = x;
        player_start_y = y;
      } else if (symbol == 'o') {
        token_add(x + 4, y + 4);
      } else if (symbol == 'b' || symbol == 'd') {
        bug_add(x, y, symbol == 'b');
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
  if (cell == CELL_SOLID) return PALETTE_GROUND;
  if (cell == CELL_CLOUD) return PALETTE_CLOUD;
  return row_is_text ? PALETTE_TEXT : PALETTE_SKY;
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
    base = (row > 0 && level_map[index - MAP_COLUMNS] == CELL_SOLID) ? BG_GROUND_FILL : BG_GROUND_TOP;
    tiles[tile_index] = base;
    tiles[tile_index + 1] = base + 1;
    tiles[tile_index + 32] = base + 16;
    tiles[tile_index + 33] = base + 17;
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
    tiles[tile_index] = BG_MOON;
    tiles[tile_index + 1] = BG_MOON + 1;
    tiles[tile_index + 32] = BG_MOON + 16;
    tiles[tile_index + 33] = BG_MOON + 17;
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
