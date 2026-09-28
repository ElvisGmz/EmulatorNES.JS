#include "game.h"
#include "assets.h"
#include "audio.h"

// Tokens are 16x16 background stars (drawn by level.c); only the pickup sparkle is a sprite
#define TOKEN_SIZE 16
#define TOKEN_MARGIN 3
#define SPARKLE_FRAMES 16
#define SPARKLE_OFFSET 4
// Claude's pickup box is a bit smaller than the sprite so grabs feel deliberate
#define REACH_LEFT 2
#define REACH_RIGHT 13
#define REACH_TOP 2
#define REACH_BOTTOM 15

u8 tokens_left;

static u8 token_count;
static u8 token_x[MAX_TOKENS];
static u8 token_y[MAX_TOKENS];
static u8 token_alive[MAX_TOKENS];
static u8 sparkle_x;
static u8 sparkle_y;
static u8 sparkle_timer;

static u8 index;

void tokens_reset(void) {
  token_count = 0;
  tokens_left = 0;
  sparkle_timer = 0;
}

void token_add(u8 x, u8 y) {
  if (token_count == MAX_TOKENS) return;
  token_x[token_count] = x;
  token_y[token_count] = y;
  token_alive[token_count] = 1;
  ++token_count;
  ++tokens_left;
}

void tokens_update(void) {
  u8 px = player_pixel_x();
  u8 py = player_pixel_y();

  if (sparkle_timer) {
    --sparkle_timer;
    --sparkle_y;
  }

  for (index = 0; index < token_count; ++index) {
    if (!token_alive[index]) continue;
    if (px + REACH_LEFT > token_x[index] + TOKEN_SIZE - TOKEN_MARGIN ||
        px + REACH_RIGHT < token_x[index] + TOKEN_MARGIN) {
      continue;
    }
    if (py + REACH_TOP > token_y[index] + TOKEN_SIZE - TOKEN_MARGIN ||
        py + REACH_BOTTOM < token_y[index] + TOKEN_MARGIN) {
      continue;
    }

    token_alive[index] = 0;
    --tokens_left;
    level_erase_cell(token_x[index], token_y[index]);
    sparkle_x = token_x[index] + SPARKLE_OFFSET;
    sparkle_y = token_y[index] + SPARKLE_OFFSET;
    sparkle_timer = SPARKLE_FRAMES;
    sfx_play(SFX_TOKEN);
    score_add(SCORE_TOKEN);
  }
}

void tokens_draw(void) {
  if (sparkle_timer) oam_sprite(sparkle_x, sparkle_y, SPR_SPARKLE, SPRITE_PALETTE_SPARKLE);
}
