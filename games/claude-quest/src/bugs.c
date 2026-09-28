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
#define WAVE_STEPS 32

// Vertical offset of flying bugs along their wave (one full cycle in 64 frames)
static const s8 flight_wave[WAVE_STEPS] = {
    0, 2, 3, 5, 6, 7, 7, 8, 8, 8, 7, 7, 6, 5, 3, 2, 0, -2, -3, -5, -6, -7, -7, -8, -8, -8, -7, -7, -6, -5, -3, -2,
};

u8 bug_count;

static u8 bug_x[MAX_BUGS];
static u8 bug_y[MAX_BUGS];
static u8 bug_left[MAX_BUGS];
static u8 bug_subpixel[MAX_BUGS];
static u8 bug_state[MAX_BUGS];
static u8 bug_timer[MAX_BUGS];
static u8 bug_flying[MAX_BUGS];
static u8 bug_base_y[MAX_BUGS];
static u8 bug_phase[MAX_BUGS];

static u8 index;

void bugs_reset(void) {
  bug_count = 0;
}

/** Adds a bug, reusing the slot of a defeated one when possible (bosses summon minions). */
void bug_add(u8 x, u8 y, u8 facing_left, u8 flying) {
  u8 slot;
  for (slot = 0; slot < bug_count && bug_state[slot] != BUG_GONE; ++slot) {
  }
  if (slot == MAX_BUGS) return;
  if (slot == bug_count) ++bug_count;

  bug_x[slot] = x;
  bug_y[slot] = y;
  bug_base_y[slot] = y;
  bug_flying[slot] = flying;
  bug_phase[slot] = slot << 3;
  bug_left[slot] = facing_left;
  bug_subpixel[slot] = 0;
  bug_state[slot] = BUG_WALKING;
}

u8 bugs_alive(void) {
  u8 alive = 0;
  for (index = 0; index < bug_count; ++index) {
    if (bug_state[index] == BUG_WALKING) ++alive;
  }
  return alive;
}

static u8 can_step_to(u8 next_x) {
  u8 front = bug_left[index] ? next_x + BUG_LEFT : next_x + BUG_RIGHT;
  u8 y = bug_y[index];
  if (next_x < SCREEN_LEFT || next_x > SCREEN_RIGHT) return 0;
  if (cell_at(front, y + 8) == CELL_SOLID || cell_at(front, y + 8) == CELL_SPRING) return 0;
  if (bug_flying[index]) return 1;
  // Walkers turn around at ledges instead of walking off
  return cell_is_floor(cell_at(front, y + CELL_SIZE));
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
    if (bug_state[index] == BUG_WALKING) {
      walk();
      if (bug_flying[index]) {
        ++bug_phase[index];
        bug_y[index] = bug_base_y[index] + flight_wave[(bug_phase[index] >> 1) & (WAVE_STEPS - 1)];
      }
    } else if (bug_state[index] == BUG_SQUASHED && --bug_timer[index] == 0) {
      bug_state[index] = BUG_GONE;
    }
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
    else if (bug_flying[index]) tile = (frame_counter & 8) ? SPR_FLY_WINGS_UP : SPR_FLY_WINGS_DOWN;
    else tile = (bug_x[index] & 4) ? SPR_BUG_WALK_2 : SPR_BUG_WALK_1;

    // The bug art faces left, so flip it when walking right
    oam_meta_2x2(bug_x[index], bug_y[index], tile, SPRITE_PALETTE_BUG | (bug_left[index] ? 0 : SPRITE_FLIP_X));
  }
}
