#include "game.h"
#include "assets.h"
#include "audio.h"

// Moving clouds: 32x8 one-way platforms that go back and forth, turning at ":" markers,
// solid blocks or the screen edges, and carry Claude along while it stands on them.
// Troll clouds look and move the same, but the first time Claude jumps near one it darts
// away from Claude until it has to turn, then goes back to its normal pace.
#define PLATFORM_WIDTH 32
#define PLATFORM_HEIGHT 8
#define HORIZONTAL_SPEED 12
#define VERTICAL_SPEED 8
#define DASH_SPEED 48
// Claude's jump sets it off when Claude's middle is this close to the cloud's middle...
#define DASH_RANGE 48
// ...and Claude's feet are at most 3 rows below the cloud top or 5 rows above it
#define DASH_BELOW 48
#define DASH_ABOVE 80
#define TROLL_NONE 0
#define TROLL_ARMED 1
#define TROLL_DASHING 2
#define SUBPIXELS_PER_PIXEL 16
#define TOP_LIMIT 40
#define BOTTOM_LIMIT 216

u8 platform_count;
u8 player_platform = NO_PLATFORM;

static u8 platform_x[MAX_PLATFORMS];
static u8 platform_y[MAX_PLATFORMS];
static u8 platform_vertical[MAX_PLATFORMS];
static u8 platform_forward[MAX_PLATFORMS];
static u8 platform_subpixel[MAX_PLATFORMS];
static s8 platform_dx[MAX_PLATFORMS];
static s8 platform_dy[MAX_PLATFORMS];
static u8 platform_troll[MAX_PLATFORMS];

static u8 index;

void platforms_reset(void) {
  platform_count = 0;
  player_platform = NO_PLATFORM;
}

void platform_add(u8 x, u8 y, u8 vertical, u8 troll) {
  if (platform_count == MAX_PLATFORMS) return;
  platform_x[platform_count] = x;
  platform_y[platform_count] = y;
  platform_vertical[platform_count] = vertical;
  platform_forward[platform_count] = 1;
  platform_subpixel[platform_count] = 0;
  platform_troll[platform_count] = troll ? TROLL_ARMED : TROLL_NONE;
  ++platform_count;
}

static u8 blocks_platform(u8 cell_type) {
  return cell_type == CELL_MARKER || cell_type == CELL_SOLID || cell_type == CELL_SPRING;
}

static u8 can_move_horizontally(u8 next_x) {
  if (next_x < SCREEN_LEFT || next_x > SCREEN_RIGHT + 16 - PLATFORM_WIDTH) return 0;
  return !blocks_platform(cell_at(platform_forward[index] ? next_x + PLATFORM_WIDTH - 1 : next_x, platform_y[index] + 4));
}

static u8 can_move_vertically(u8 next_y) {
  u8 edge;
  if (next_y < TOP_LIMIT || next_y > BOTTOM_LIMIT) return 0;
  edge = platform_forward[index] ? next_y + PLATFORM_HEIGHT - 1 : next_y;
  return !blocks_platform(cell_at(platform_x[index] + 8, edge)) && cell_at(platform_x[index] + 8, edge) != CELL_CLOUD;
}

static void step(void) {
  u8 next;

  if (platform_vertical[index]) {
    next = platform_forward[index] ? platform_y[index] + 1 : platform_y[index] - 1;
    if (can_move_vertically(next)) {
      platform_dy[index] += platform_forward[index] ? 1 : -1;
      platform_y[index] = next;
    } else {
      platform_forward[index] = !platform_forward[index];
    }
    return;
  }

  next = platform_forward[index] ? platform_x[index] + 1 : platform_x[index] - 1;
  if (can_move_horizontally(next)) {
    platform_dx[index] += platform_forward[index] ? 1 : -1;
    platform_x[index] = next;
  } else {
    platform_forward[index] = !platform_forward[index];
    if (platform_troll[index] == TROLL_DASHING) platform_troll[index] = TROLL_NONE;
  }
}

static void move(void) {
  u8 speed = platform_vertical[index] ? VERTICAL_SPEED : HORIZONTAL_SPEED;
  if (platform_troll[index] == TROLL_DASHING) speed = DASH_SPEED;

  platform_dx[index] = 0;
  platform_dy[index] = 0;
  platform_subpixel[index] += speed;
  while (platform_subpixel[index] >= SUBPIXELS_PER_PIXEL) {
    platform_subpixel[index] -= SUBPIXELS_PER_PIXEL;
    step();
  }
}

/** A troll cloud darts away the first time Claude jumps close to it. */
static void check_troll(void) {
  s16 claude_middle;
  s16 cloud_middle;
  s16 feet;

  if (platform_troll[index] != TROLL_ARMED || player_on_ground) return;
  claude_middle = (s16)player_pixel_x() + 8;
  cloud_middle = (s16)platform_x[index] + (PLATFORM_WIDTH >> 1);
  if (claude_middle + DASH_RANGE <= cloud_middle || claude_middle >= cloud_middle + DASH_RANGE) return;
  feet = (s16)player_pixel_y() + 16;
  if (feet > (s16)platform_y[index] + DASH_BELOW || feet + DASH_ABOVE < (s16)platform_y[index]) return;

  platform_troll[index] = TROLL_DASHING;
  platform_forward[index] = claude_middle < cloud_middle;
  platform_subpixel[index] = 0;
  sfx_play(SFX_DASH);
}

void platforms_update(void) {
  for (index = 0; index < platform_count; ++index) {
    check_troll();
    move();
  }
}

/** Moves Claude with the cloud it is standing on; call right after platforms_update. */
void platforms_carry_player(void) {
  if (player_platform == NO_PLATFORM) return;
  player_x += (s16)platform_dx[player_platform] << 4;
  player_y += (s16)platform_dy[player_platform] << 4;
}

/** Returns the cloud Claude lands on when its feet cross a cloud top this frame, or NO_PLATFORM. */
u8 platform_landing(u8 x, u8 previous_feet, u8 feet) {
  for (index = 0; index < platform_count; ++index) {
    if (x + 12 < platform_x[index] || x + 3 > platform_x[index] + PLATFORM_WIDTH - 1) continue;
    if (previous_feet <= platform_y[index] && feet >= platform_y[index]) return index;
  }
  return NO_PLATFORM;
}

u8 platform_top(u8 platform) {
  return platform_y[platform];
}

void platforms_draw(u8 reverse) {
  u8 i;
  u8 x;
  for (i = 0; i < platform_count; ++i) {
    index = reverse ? platform_count - 1 - i : i;
    x = platform_x[index];
    oam_sprite(x, platform_y[index], SPR_PLATFORM, SPRITE_PALETTE_PLATFORM);
    oam_sprite(x + 8, platform_y[index], SPR_PLATFORM + 1, SPRITE_PALETTE_PLATFORM);
    oam_sprite(x + 16, platform_y[index], SPR_PLATFORM + 2, SPRITE_PALETTE_PLATFORM);
    oam_sprite(x + 24, platform_y[index], SPR_PLATFORM + 3, SPRITE_PALETTE_PLATFORM);
  }
}
