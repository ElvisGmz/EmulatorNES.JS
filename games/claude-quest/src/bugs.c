#include "game.h"
#include "assets.h"
#include "audio.h"

#define BUG_GONE 0
#define BUG_WALKING 1
#define BUG_SQUASHED 2
#define SQUASHED_FRAMES 30
#define SUBPIXELS_PER_PIXEL 16

// Collision boxes relative to the 16x16 sprites
#define BUG_LEFT 2
#define BUG_RIGHT 13
#define BUG_TOP 6
#define PLAYER_LEFT 3
#define PLAYER_RIGHT 12
#define PLAYER_TOP 2
#define PLAYER_BOTTOM 15
// A stomp only counts when Claude's feet are within the top of the bug
#define STOMP_DEPTH 6

u8 bug_count;

static u8 bug_x[MAX_BUGS];
static u8 bug_y[MAX_BUGS];
static u8 bug_left[MAX_BUGS];
static u8 bug_subpixel[MAX_BUGS];
static u8 bug_state[MAX_BUGS];
static u8 bug_timer[MAX_BUGS];

static u8 index;

void bugs_reset(void) {
  bug_count = 0;
}

void bug_add(u8 x, u8 y, u8 facing_left) {
  if (bug_count == MAX_BUGS) return;
  bug_x[bug_count] = x;
  bug_y[bug_count] = y;
  bug_left[bug_count] = facing_left;
  bug_subpixel[bug_count] = 0;
  bug_state[bug_count] = BUG_WALKING;
  ++bug_count;
}

static u8 can_step_to(u8 next_x) {
  u8 front = bug_left[index] ? next_x + BUG_LEFT : next_x + BUG_RIGHT;
  u8 y = bug_y[index];
  if (next_x < SCREEN_LEFT || next_x > SCREEN_RIGHT) return 0;
  if (cell_at(front, y + 8) == CELL_SOLID) return 0;
  // Turn around at ledges instead of walking off
  return cell_at(front, y + CELL_SIZE) != CELL_EMPTY;
}

static void walk(void) {
  u8 next_x;

  bug_subpixel[index] += bug_speed;
  while (bug_subpixel[index] >= SUBPIXELS_PER_PIXEL) {
    bug_subpixel[index] -= SUBPIXELS_PER_PIXEL;
    next_x = bug_left[index] ? bug_x[index] - 1 : bug_x[index] + 1;
    if (can_step_to(next_x)) bug_x[index] = next_x;
    else bug_left[index] = !bug_left[index];
  }
}

void bugs_update(void) {
  for (index = 0; index < bug_count; ++index) {
    if (bug_state[index] == BUG_WALKING) walk();
    else if (bug_state[index] == BUG_SQUASHED && --bug_timer[index] == 0) bug_state[index] = BUG_GONE;
  }
}

/** Returns 1 when Claude stomps a bug, 2 when a bug hurts Claude, 0 otherwise. */
u8 bugs_check_player(void) {
  u8 px = player_pixel_x();
  u8 py = player_pixel_y();

  for (index = 0; index < bug_count; ++index) {
    if (bug_state[index] != BUG_WALKING) continue;
    if (px + PLAYER_LEFT > bug_x[index] + BUG_RIGHT || px + PLAYER_RIGHT < bug_x[index] + BUG_LEFT) continue;
    if (py + PLAYER_TOP > bug_y[index] + 15 || py + PLAYER_BOTTOM < bug_y[index] + BUG_TOP) continue;

    if (player_velocity_y > 0 && py + PLAYER_BOTTOM < bug_y[index] + BUG_TOP + STOMP_DEPTH) {
      bug_state[index] = BUG_SQUASHED;
      bug_timer[index] = SQUASHED_FRAMES;
      player_bounce();
      sfx_play(SFX_STOMP);
      score_add(SCORE_BUG);
      return 1;
    }
    return player_invincible ? 0 : 2;
  }
  return 0;
}

void bugs_draw(u8 reverse) {
  u8 i;
  u8 tile;
  for (i = 0; i < bug_count; ++i) {
    index = reverse ? bug_count - 1 - i : i;
    if (bug_state[index] == BUG_GONE) continue;

    if (bug_state[index] == BUG_SQUASHED) tile = SPR_BUG_SQUASHED;
    else tile = (bug_x[index] & 4) ? SPR_BUG_WALK_2 : SPR_BUG_WALK_1;

    // The bug art faces left, so flip it when walking right
    oam_meta_2x2(bug_x[index], bug_y[index], tile, SPRITE_PALETTE_BUG | (bug_left[index] ? 0 : SPRITE_FLIP_X));
  }
}
