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
#define REGROW_FRAMES 420
// Troll levels: a runaway token jumps to its next spot when Claude gets this close
#define RUNAWAY_MARGIN 16
#define MAX_RUNAWAY_SPOTS 3
#define NO_RUNAWAY 0xFF
#define MAX_HIDDEN 6
#define RUNAWAY_MESSAGE_FRAMES 90
// Erasing a token and drawing it elsewhere plus the message (43 bytes), with room kept for
// another token picked up in the same frame; otherwise the hop waits for the next frame
#define RUNAWAY_VRAM_COST (43 + 35)

u8 tokens_left;
u8 encore_played;

static u8 token_count;
static u8 token_x[MAX_TOKENS];
static u8 token_y[MAX_TOKENS];
static u8 token_alive[MAX_TOKENS];
static u8 token_regrow[MAX_TOKENS];
static u8 ammo_mode;
static u8 sparkle_x;
static u8 sparkle_y;
static u8 sparkle_timer;

static u8 runaway;
static u8 runaway_spots;
static u8 runaway_hops;
// Map index of each spot, (row << 4) | column, and of each hidden token
static u8 runaway_cells[MAX_RUNAWAY_SPOTS];
static u8 hidden_count;
static u8 hidden_cells[MAX_HIDDEN];

static const char *const runaway_taunts[MAX_RUNAWAY_SPOTS] = {"Y NO TENES EL MAX!?", "NOPE!", "TOO SLOW!"};

static u8 index;
static u8 px;
static u8 py;

void tokens_reset(void) {
  token_count = 0;
  tokens_left = 0;
  sparkle_timer = 0;
  runaway = NO_RUNAWAY;
  runaway_spots = 0;
  runaway_hops = 0;
  hidden_count = 0;
}

void tokens_set_ammo_mode(u8 enabled) {
  ammo_mode = enabled;
}

void token_add(u8 x, u8 y) {
  if (token_count == MAX_TOKENS) return;
  token_x[token_count] = x;
  token_y[token_count] = y;
  token_alive[token_count] = 1;
  token_regrow[token_count] = 0;
  ++token_count;
  ++tokens_left;
}

/** The token added last runs away from Claude to the level's numbered spots. */
void token_make_runaway(void) {
  runaway = token_count - 1;
}

void token_add_runaway_spot(u8 spot, u8 x, u8 y) {
  runaway_cells[spot] = (y & 0xF0) | (x >> 4);
  if (spot >= runaway_spots) runaway_spots = spot + 1;
}

void token_add_hidden(u8 x, u8 y) {
  if (hidden_count == MAX_HIDDEN) return;
  hidden_cells[hidden_count] = (y & 0xF0) | (x >> 4);
  ++hidden_count;
}

u8 tokens_hidden_left(void) {
  return hidden_count;
}

static void sparkle_at(u8 x, u8 y) {
  sparkle_x = x + SPARKLE_OFFSET;
  sparkle_y = y + SPARKLE_OFFSET;
  sparkle_timer = SPARKLE_FRAMES;
}

/** Shows the next hidden token (one per call, so the fake clear can pop them in one by one). */
void tokens_reveal_one(void) {
  u8 x;
  u8 y;
  if (hidden_count == 0) return;
  --hidden_count;
  x = hidden_cells[hidden_count] << 4;
  y = hidden_cells[hidden_count] & 0xF0;
  token_add(x, y);
  level_draw_token_cell(x, y);
  sparkle_at(x, y);
  sfx_play(SFX_TOKEN);
}

/** Whether Claude's pickup box comes within `margin` pixels of the current token. */
static u8 player_reaches(u8 margin) {
  if (px + REACH_LEFT > token_x[index] + TOKEN_SIZE - TOKEN_MARGIN + margin ||
      px + REACH_RIGHT + margin < token_x[index] + TOKEN_MARGIN) {
    return 0;
  }
  return py + REACH_TOP <= token_y[index] + TOKEN_SIZE - TOKEN_MARGIN + margin &&
         py + REACH_BOTTOM + margin >= token_y[index] + TOKEN_MARGIN;
}

static void run_away(void) {
  u8 cell = runaway_cells[runaway_hops];

  if (vram_queue_space() < RUNAWAY_VRAM_COST) return;
  level_erase_cell(token_x[index], token_y[index]);
  sparkle_at(token_x[index], token_y[index]);
  token_x[index] = cell << 4;
  token_y[index] = cell & 0xF0;
  level_draw_token_cell(token_x[index], token_y[index]);
  message_write(MESSAGE_ROW, runaway_taunts[runaway_hops]);
  message_expire(RUNAWAY_MESSAGE_FRAMES);
  ++runaway_hops;
  sfx_play(SFX_RUNAWAY);
}

void tokens_update(void) {
  px = player_pixel_x();
  py = player_pixel_y();

  if (sparkle_timer) {
    --sparkle_timer;
    --sparkle_y;
  }

  for (index = 0; index < token_count; ++index) {
    if (!token_alive[index]) {
      if (token_regrow[index] && --token_regrow[index] == 0) {
        token_alive[index] = 1;
        level_draw_token_cell(token_x[index], token_y[index]);
      }
      continue;
    }
    if (ammo_mode && star_ammo == MAX_STAR_AMMO) continue;
    if (index == runaway && runaway_hops < runaway_spots) {
      if (player_reaches(RUNAWAY_MARGIN)) run_away();
      continue;
    }
    if (!player_reaches(0)) continue;

    token_alive[index] = 0;
    if (ammo_mode) {
      ++star_ammo;
      token_regrow[index] = REGROW_FRAMES;
    } else {
      --tokens_left;
    }
    level_erase_cell(token_x[index], token_y[index]);
    sparkle_at(token_x[index], token_y[index]);
    sfx_play(SFX_TOKEN);
    score_add(SCORE_TOKEN);
  }
}

void tokens_draw(void) {
  if (sparkle_timer) oam_sprite(sparkle_x, sparkle_y, SPR_SPARKLE, SPRITE_PALETTE_SPARKLE);
}
