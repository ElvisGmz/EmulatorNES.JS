#include "game.h"
#include "assets.h"
#include "audio.h"

#define SCREEN_COLUMNS 32
#define SCORE_COLUMN 2
#define SCORE_DIGITS_COLUMN 8
#define LIVES_COLUMN 16
#define LEVEL_COLUMN 23
#define LEVEL_DIGIT_COLUMN 29
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

void hud_draw(void) {
  text_write(SCORE_COLUMN, HUD_ROW, "SCORE");
  text_write(LEVEL_COLUMN, HUD_ROW, "LEVEL");
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

  vram_address(NAMETABLE_ADDR(LEVEL_DIGIT_COLUMN, HUD_ROW));
  PPU_DATA = '1' + current_level;
}

/** Queues the HUD values for the next frame while rendering is on. */
void hud_refresh(void) {
  format_score();
  vram_queue_bytes(NAMETABLE_ADDR(SCORE_DIGITS_COLUMN, HUD_ROW), digits, 6);
  format_status();
  vram_queue_bytes(NAMETABLE_ADDR(LIVES_COLUMN, HUD_ROW), line, 3);
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
