#include "game.h"
#include "assets.h"

#define SCREEN_GROUND_ROW 12
#define GROUND_Y (SCREEN_GROUND_ROW * CELL_SIZE - 16)
#define BLINK_MASK 0x20

#define TITLE_LOGO_ROW 6
#define TITLE_SUBTITLE_ROW 11
#define TITLE_PROMPT_ROW 16
#define TITLE_CONTROLS_ROW 19
#define TITLE_CREDITS_ROW 21
#define TITLE_TEXT_ROWS ((1 << 3) | (1 << 4) | (1 << 5) | (1 << 8) | (1 << 9) | (1 << 10))

#define WIN_TEXT_ROWS ((1 << 3) | (1 << 4) | (1 << 6) | (1 << 7) | (1 << 9))
#define WIN_PROMPT_ROW 18
#define WIN_TROLLED_ROW 13

static const char press_start[] = "PRESS START";
static const char blank_prompt[] = "           ";
static const char trolled_label[] = "TROLLED ";
static const char times_label[] = " TIMES";

// Decorative tokens floating around the title and ending screens
static const u8 decoration_x[] = {40, 208, 64, 184, 120};
static const u8 decoration_y[] = {60, 64, 140, 136, 104};

static u8 walker_x;
static u8 walker_left;
static u8 hop;
static s8 hop_velocity;
static u8 index;

static void draw_prompt(u8 row) {
  if ((frame_counter & (BLINK_MASK - 1)) != 0) return;
  text_queue_centered(row, (frame_counter & BLINK_MASK) ? blank_prompt : press_start);
}

static void draw_decorations(void) {
  u8 phase;
  for (index = 0; index < sizeof(decoration_x); ++index) {
    phase = (frame_counter >> 3) + index;
    oam_sprite(decoration_x[index], decoration_y[index] + ((phase >> 2) & 1), SPR_TOKEN + (phase & 1),
               SPRITE_PALETTE_SPARKLE);
  }
}

static void draw_walker(u8 hops) {
  u8 tile = (walker_x & 8) ? SPR_CLAUDE_WALK_1 : SPR_CLAUDE_WALK_2;

  if (hops) {
    if (hop == 0 && (frame_counter & 63) == 0) hop_velocity = 5;
    if (hop_velocity || hop) {
      hop += hop_velocity;
      --hop_velocity;
      if ((s8)hop <= 0) {
        hop = 0;
        hop_velocity = 0;
      }
    }
    if (hop) tile = SPR_CLAUDE_JUMP;
  }

  if (walker_left) {
    if (--walker_x < 24) walker_left = 0;
  } else if (++walker_x > 216) {
    walker_left = 1;
  }

  oam_meta_2x2(walker_x, GROUND_Y - hop, tile, SPRITE_PALETTE_CLAUDE | (walker_left ? SPRITE_FLIP_X : 0));
}

static void reset_walker(void) {
  walker_x = 40;
  walker_left = 0;
  hop = 0;
  hop_velocity = 0;
}

void title_draw(void) {
  u8 row;

  current_level = 0;
  sky_draw(SCREEN_GROUND_ROW, TITLE_TEXT_ROWS);

  for (row = 0; row < LOGO_HEIGHT; ++row) {
    vram_address(NAMETABLE_ADDR((32 - LOGO_WIDTH) >> 1, TITLE_LOGO_ROW + row));
    vram_write(&logo_layout[row * LOGO_WIDTH], LOGO_WIDTH);
  }
  text_write(10, TITLE_SUBTITLE_ROW, "TOKEN QUEST");
  text_write(10, TITLE_PROMPT_ROW, press_start);
  text_write(7, TITLE_CONTROLS_ROW, "A JUMP    B RUN");
  text_write(6, TITLE_CREDITS_ROW, "ELVIS + CLAUDE  2026");
  reset_walker();
}

void title_update(void) {
  draw_prompt(TITLE_PROMPT_ROW);
  draw_walker(0);
  draw_decorations();
}

/** "TROLLED 12 TIMES" under the score on the ending screen. */
static void write_trolled(void) {
  u8 text[20];
  u8 length;
  for (length = 0; trolled_label[length]; ++length) text[length] = trolled_label[length];
  length += format_trolled(&text[length]);
  for (index = 0; times_label[index]; ++index) text[length++] = times_label[index];
  // "1 TIME", not "1 TIMES"
  if (times_trolled == 1) --length;
  vram_address(NAMETABLE_ADDR((32 - length) >> 1, WIN_TROLLED_ROW));
  vram_write(text, length);
}

void win_draw(void) {
  u8 digits[6];
  u16 value = score;
  u8 position = 5;

  sky_draw(SCREEN_GROUND_ROW, WIN_TEXT_ROWS);
  text_write(10, 6, "YOU DID IT!");
  text_write(6, 9, "ALL TOKENS COLLECTED");
  text_write(10, 12, "SCORE");

  digits[5] = '0';
  while (position--) {
    digits[position] = '0' + value % 10;
    value /= 10;
  }
  vram_address(NAMETABLE_ADDR(16, 12));
  vram_write(digits, 6);

  if (times_trolled) write_trolled();
  text_write(7, 15, "THANKS FOR PLAYING");
  text_write(10, WIN_PROMPT_ROW, press_start);
  reset_walker();
}

void win_update(void) {
  draw_prompt(WIN_PROMPT_ROW);
  draw_walker(1);
  draw_decorations();
}
