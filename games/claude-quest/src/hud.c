#include "game.h"
#include "assets.h"
#include "audio.h"

#define SCREEN_COLUMNS 32
#define SCORE_COLUMN 2
#define SCORE_DIGITS_COLUMN 8
#define LIVES_COLUMN 16
#define LEVEL_COLUMN 23
#define LEVEL_DIGIT_COLUMN 29
#define AMMO_COLUMN 23
#define BOSS_ROW 3
#define BOSS_NAME_COLUMN 2
#define HEALTH_BAR_END_COLUMN 30
#define HEALTH_PER_TILE 2
#define MAX_LIVES 9

u16 score;
u8 lives;

static u16 next_extra_life;
static u8 digits[6];
static u8 line[SCREEN_COLUMNS];
static u8 length;

static u8 text_length(const char *text) {
  for (length = 0; text[length]; ++length) {
  }
  return length;
}

void text_write(u8 column, u8 row, const char *text) {
  vram_address(NAMETABLE_ADDR(column, row));
  while (*text) PPU_DATA = *text++;
}

void text_queue(u8 column, u8 row, const char *text) {
  vram_queue_bytes(NAMETABLE_ADDR(column, row), (const u8 *)text, text_length(text));
}

void text_queue_centered(u8 row, const char *text) {
  text_queue((SCREEN_COLUMNS - text_length(text)) >> 1, row, text);
}

void text_clear_row(u8 row) {
  for (length = 0; length < SCREEN_COLUMNS; ++length) line[length] = BG_EMPTY;
  vram_queue_bytes(NAMETABLE_ADDR(0, row), line, SCREEN_COLUMNS);
}

// Score is kept in tens: the last digit on screen is always 0
static void format_score(void) {
  u16 value = score;
  u8 position = 5;
  digits[5] = '0';
  while (position--) {
    digits[position] = '0' + value % 10;
    value /= 10;
  }
}

static void format_status(void) {
  line[0] = BG_LIFE_ICON;
  line[1] = '*';
  line[2] = '0' + lives;
}

static void format_ammo(void) {
  line[0] = BG_AMMO_ICON;
  line[1] = '*';
  line[2] = '0' + star_ammo;
}

static u8 health_bar_tiles(void) {
  return (boss_max_health + HEALTH_PER_TILE - 1) / HEALTH_PER_TILE;
}

static void format_health_bar(void) {
  u8 remaining = boss_health;
  u8 tiles = health_bar_tiles();
  for (length = 0; length < tiles; ++length) {
    if (remaining >= HEALTH_PER_TILE) {
      line[length] = BG_HEALTH_FULL;
      remaining -= HEALTH_PER_TILE;
    } else {
      line[length] = remaining ? BG_HEALTH_HALF : BG_HEALTH_EMPTY;
      remaining = 0;
    }
  }
}

static u8 is_boss_level(void) {
  return level_boss(current_level) != BOSS_NONE;
}

void hud_draw(void) {
  text_write(SCORE_COLUMN, HUD_ROW, "SCORE");
  if (is_boss_level()) text_write(BOSS_NAME_COLUMN, BOSS_ROW, boss_name());
  else text_write(LEVEL_COLUMN, HUD_ROW, "LEVEL");
  hud_refresh_now();
}

/** Writes the HUD values directly; rendering must be off. */
void hud_refresh_now(void) {
  format_score();
  vram_address(NAMETABLE_ADDR(SCORE_DIGITS_COLUMN, HUD_ROW));
  vram_write(digits, 6);

  format_status();
  vram_address(NAMETABLE_ADDR(LIVES_COLUMN, HUD_ROW));
  vram_write(line, 3);

  if (is_boss_level()) {
    format_ammo();
    vram_address(NAMETABLE_ADDR(AMMO_COLUMN, HUD_ROW));
    vram_write(line, 3);
    format_health_bar();
    vram_address(NAMETABLE_ADDR(HEALTH_BAR_END_COLUMN - health_bar_tiles(), BOSS_ROW));
    vram_write(line, health_bar_tiles());
    return;
  }

  length = level_number(current_level);
  vram_address(NAMETABLE_ADDR(LEVEL_DIGIT_COLUMN, HUD_ROW));
  if (length >= 10) {
    PPU_DATA = '1';
    PPU_DATA = '0' + length - 10;
  } else {
    PPU_DATA = '0' + length;
    PPU_DATA = ' ';
  }
}

/** Queues the HUD values for the next frame while rendering is on. */
void hud_refresh(void) {
  format_score();
  vram_queue_bytes(NAMETABLE_ADDR(SCORE_DIGITS_COLUMN, HUD_ROW), digits, 6);
  format_status();
  vram_queue_bytes(NAMETABLE_ADDR(LIVES_COLUMN, HUD_ROW), line, 3);
  if (is_boss_level()) hud_refresh_ammo();
}

void hud_refresh_ammo(void) {
  format_ammo();
  vram_queue_bytes(NAMETABLE_ADDR(AMMO_COLUMN, HUD_ROW), line, 3);
}

void hud_refresh_boss(void) {
  format_health_bar();
  vram_queue_bytes(NAMETABLE_ADDR(HEALTH_BAR_END_COLUMN - health_bar_tiles(), BOSS_ROW), line, health_bar_tiles());
}

void score_reset(void) {
  score = 0;
  lives = STARTING_LIVES;
  next_extra_life = SCORE_PER_EXTRA_LIFE;
}

void score_add(u8 tens) {
  score += tens;
  if (score >= next_extra_life) {
    next_extra_life += SCORE_PER_EXTRA_LIFE;
    if (lives < MAX_LIVES) {
      ++lives;
      sfx_play(SFX_LIFE);
    }
  }
  hud_refresh();
}
