#include "game.h"
#include "assets.h"
#include "audio.h"

#define TOKEN_SIZE 8
#define SPARKLE_FRAMES 16
// Claude's pickup box is a bit smaller than the sprite so grabs feel deliberate
#define REACH_LEFT 2
#define REACH_RIGHT 13
#define REACH_TOP 2
#define REACH_BOTTOM 15

// Twinkle cycle: big, medium, small, medium
static const u8 twinkle_frames[4] = {0, 1, 2, 1};

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
    if (px + REACH_LEFT > token_x[index] + TOKEN_SIZE - 1 || px + REACH_RIGHT < token_x[index]) continue;
    if (py + REACH_TOP > token_y[index] + TOKEN_SIZE - 1 || py + REACH_BOTTOM < token_y[index]) continue;

    token_alive[index] = 0;
    --tokens_left;
    sparkle_x = token_x[index];
    sparkle_y = token_y[index];
    sparkle_timer = SPARKLE_FRAMES;
    sfx_play(SFX_TOKEN);
    score_add(SCORE_TOKEN);
  }
}

void tokens_draw(u8 reverse) {
  u8 i;
  u8 phase;
  for (i = 0; i < token_count; ++i) {
    index = reverse ? token_count - 1 - i : i;
    if (!token_alive[index]) continue;

    phase = (frame_counter >> 3) + index;
    oam_sprite(token_x[index], token_y[index] + ((phase >> 2) & 1), SPR_TOKEN + twinkle_frames[phase & 3],
               SPRITE_PALETTE_TOKEN);
  }

  if (sparkle_timer) oam_sprite(sparkle_x, sparkle_y, SPR_SPARKLE, SPRITE_PALETTE_TOKEN);
}
