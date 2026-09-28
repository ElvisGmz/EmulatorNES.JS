#include "game.h"
#include "assets.h"
#include "audio.h"

// Troll traps. Until Claude gets close, crumbling ground is plain ground, and hidden spikes
// and icicles are not drawn at all. Each one springs with a short warning (cracks in the
// ground, a shaking icicle) so a quick player can react, and a retry shows where they are.
#define MAX_TRAPS 12
#define MAX_ICICLES 4

// Trap states; spikes keep their kind in the top bit
#define TRAP_DONE 0
#define TRAP_ARMED 1
#define TRAP_TRIGGERED 2
#define TRAP_CRACKED 3
#define TRAP_STATE_MASK 0x7F
#define TRAP_SPIKES_FLAG 0x80

// Ground cracks as soon as Claude is over it (standing, or up to 4 rows above) and falls
// away a moment later, together with the ground below it and every "%" next to it
#define CRUMBLE_REACH 64
#define CRACK_FRAMES 12
// Spikes pop up when Claude is about to walk into them or land on them
#define SPIKES_MARGIN 10
#define SPIKES_REACH 32
// Icicles shake when Claude walks near underneath, then drop fast
#define ICICLE_RANGE 28
#define SHAKE_FRAMES 8
#define MAX_FALL_SPEED 8

#define ICICLE_GONE 0
#define ICICLE_HIDDEN 1
#define ICICLE_SHAKING 2
#define ICICLE_FALLING 3

// VRAM queue bytes each redraw needs (see level.c), plus room kept for a score update
// later in the same frame; a redraw that does not fit waits for the next frame
#define VRAM_HEADROOM 15
#define CELL_REDRAW_COST (10 + VRAM_HEADROOM)
#define SPIKES_REDRAW_COST (14 + VRAM_HEADROOM)

#define PLAYER_LEFT 3
#define PLAYER_RIGHT 12
#define PLAYER_TOP 2
#define PLAYER_BOTTOM 15
#define ICICLE_LEFT 4
#define ICICLE_RIGHT 11
#define ICICLE_TOP 2
#define ICICLE_BOTTOM 15

static u8 trap_count;
// Map index of each trap's cell: (row << 4) | column
static u8 trap_cell[MAX_TRAPS];
static u8 trap_state[MAX_TRAPS];
static u8 crack_timer;

static u8 icicle_count;
static u8 icicle_x[MAX_ICICLES];
static u8 icicle_y[MAX_ICICLES];
static u8 icicle_state[MAX_ICICLES];
// Shake frames left while shaking, then the fall speed in pixels per frame
static u8 icicle_timer[MAX_ICICLES];

static u8 index;
static u8 other;
static u8 px;
static u8 py;
static u8 cell_x;
static u8 cell_y;

void traps_reset(void) {
  trap_count = 0;
  icicle_count = 0;
  crack_timer = 0;
}

void trap_add(u8 kind, u8 x, u8 y) {
  if (trap_count == MAX_TRAPS) return;
  trap_cell[trap_count] = (y & 0xF0) | (x >> 4);
  trap_state[trap_count] = TRAP_ARMED | (kind == TRAP_SPIKES ? TRAP_SPIKES_FLAG : 0);
  ++trap_count;
}

void icicle_add(u8 x, u8 y) {
  if (icicle_count == MAX_ICICLES) return;
  icicle_x[icicle_count] = x;
  icicle_y[icicle_count] = y;
  icicle_state[icicle_count] = ICICLE_HIDDEN;
  ++icicle_count;
}

static void read_cell(void) {
  cell_x = trap_cell[index] << 4;
  cell_y = trap_cell[index] & 0xF0;
}

static u8 player_over_cell(u8 margin) {
  return px + PLAYER_RIGHT + margin >= cell_x && px + PLAYER_LEFT <= cell_x + CELL_SIZE - 1 + margin;
}

static u8 is_neighbor(void) {
  u8 first = trap_cell[index];
  u8 second = trap_cell[other];
  u8 column_gap = (first & 0x0F) > (second & 0x0F) ? (first & 0x0F) - (second & 0x0F) : (second & 0x0F) - (first & 0x0F);
  u8 row_gap = (first >> 4) > (second >> 4) ? (first >> 4) - (second >> 4) : (second >> 4) - (first >> 4);
  return column_gap <= 1 && row_gap <= 1;
}

/** Cracks the triggered ground and every armed "%" connected to it, so a whole pit opens at once. */
static void trigger_crumble(void) {
  u8 first = index;
  u8 spread;

  trap_state[index] = TRAP_TRIGGERED;
  do {
    spread = 0;
    for (index = 0; index < trap_count; ++index) {
      if (trap_state[index] != TRAP_ARMED) continue;
      for (other = 0; other < trap_count; ++other) {
        if ((trap_state[other] == TRAP_TRIGGERED || trap_state[other] == TRAP_CRACKED) && is_neighbor()) {
          trap_state[index] = TRAP_TRIGGERED;
          spread = 1;
          break;
        }
      }
    }
  } while (spread);

  index = first;
  crack_timer = CRACK_FRAMES;
  sfx_play(SFX_CRUMBLE);
}

/** Erases a crumbling cell and the ground below it, over several frames if the VRAM queue is full. */
static void collapse(void) {
  while (cell_at(cell_x, cell_y) == CELL_SOLID) {
    if (vram_queue_space() < CELL_REDRAW_COST) {
      trap_cell[index] = (cell_y & 0xF0) | (cell_x >> 4);
      return;
    }
    level_erase_cell(cell_x, cell_y);
    cell_y += CELL_SIZE;
  }
  trap_state[index] = TRAP_DONE;
}

static void update_crumble(u8 state) {
  u8 feet;

  if (state == TRAP_ARMED) {
    feet = py + PLAYER_BOTTOM + 1;
    if (player_over_cell(0) && feet <= cell_y && feet + CRUMBLE_REACH >= cell_y) trigger_crumble();
  } else if (state == TRAP_TRIGGERED) {
    if (vram_queue_space() < CELL_REDRAW_COST) return;
    level_draw_cracked_cell(cell_x, cell_y);
    trap_state[index] = TRAP_CRACKED;
  } else if (state == TRAP_CRACKED && crack_timer == 0) {
    collapse();
  }
}

static void update_spikes(void) {
  u8 feet = py + PLAYER_BOTTOM + 1;
  if (!player_over_cell(SPIKES_MARGIN)) return;
  if (feet > cell_y + CELL_SIZE || feet + SPIKES_REACH < cell_y + CELL_SIZE) return;
  if (vram_queue_space() < SPIKES_REDRAW_COST) return;
  level_set_cell(cell_x, cell_y, CELL_SPIKES);
  trap_state[index] = TRAP_DONE;
  sfx_play(SFX_POP);
}

static void update_icicle(void) {
  u8 state = icicle_state[index];
  u8 distance;

  if (state == ICICLE_HIDDEN) {
    distance = px > icicle_x[index] ? px - icicle_x[index] : icicle_x[index] - px;
    if (py > icicle_y[index] && distance < ICICLE_RANGE) {
      icicle_state[index] = ICICLE_SHAKING;
      icicle_timer[index] = SHAKE_FRAMES;
      sfx_play(SFX_ICICLE);
    }
  } else if (state == ICICLE_SHAKING) {
    if (--icicle_timer[index] == 0) icicle_state[index] = ICICLE_FALLING;
  } else if (state == ICICLE_FALLING) {
    if (icicle_timer[index] < MAX_FALL_SPEED) ++icicle_timer[index];
    icicle_y[index] += icicle_timer[index];
    if (icicle_y[index] >= SCREEN_BOTTOM) {
      icicle_state[index] = ICICLE_GONE;
      return;
    }
    // Icicles fall through clouds and shatter on the ground
    other = cell_at(icicle_x[index] + 8, icicle_y[index] + ICICLE_BOTTOM);
    if (other == CELL_SOLID || other == CELL_SPRING) {
      icicle_state[index] = ICICLE_GONE;
      sfx_play(SFX_SHATTER);
    }
  }
}

void traps_update(void) {
  u8 state;

  px = player_pixel_x();
  py = player_pixel_y();
  if (crack_timer) --crack_timer;

  for (index = 0; index < trap_count; ++index) {
    state = trap_state[index];
    if (state == TRAP_DONE) continue;
    read_cell();
    if (state & TRAP_SPIKES_FLAG) update_spikes();
    else update_crumble(state & TRAP_STATE_MASK);
  }

  for (index = 0; index < icicle_count; ++index) update_icicle();
}

/** Returns 1 when a shaking or falling icicle touches Claude. */
u8 traps_hurt_player(void) {
  if (player_invincible) return 0;
  px = player_pixel_x();
  py = player_pixel_y();
  for (index = 0; index < icicle_count; ++index) {
    if (icicle_state[index] < ICICLE_SHAKING) continue;
    if (px + PLAYER_RIGHT < icicle_x[index] + ICICLE_LEFT || px + PLAYER_LEFT > icicle_x[index] + ICICLE_RIGHT) continue;
    if (py + PLAYER_BOTTOM >= icicle_y[index] + ICICLE_TOP && py + PLAYER_TOP <= icicle_y[index] + ICICLE_BOTTOM) return 1;
  }
  return 0;
}

void traps_draw(void) {
  u8 x;
  for (index = 0; index < icicle_count; ++index) {
    if (icicle_state[index] < ICICLE_SHAKING) continue;
    x = icicle_x[index];
    // Shaking moves the icicle one pixel left and right
    if (icicle_state[index] == ICICLE_SHAKING) x = x - 1 + (frame_counter & 2);
    oam_meta_2x2(x, icicle_y[index], SPR_ICICLE, SPRITE_PALETTE_PLATFORM);
  }
}
