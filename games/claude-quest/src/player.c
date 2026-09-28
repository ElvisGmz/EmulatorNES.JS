#include "game.h"
#include "assets.h"
#include "audio.h"

// Positions and speeds are in 1/16 pixel units
#define SUBPIXEL_SHIFT 4
#define WALK_SPEED 24
#define RUN_SPEED 36
#define GROUND_ACCELERATION 3
#define AIR_ACCELERATION 2
#define GRAVITY 4
#define JUMP_HOLD_GRAVITY 3
#define JUMP_VELOCITY -76
#define BOUNCE_VELOCITY -56
#define SPRING_VELOCITY -88
#define MAX_FALL_SPEED 64

// Forgiveness windows that make jumps feel responsive
#define COYOTE_FRAMES 6
#define JUMP_BUFFER_FRAMES 6
#define CLOUD_DROP_FRAMES 10
#define RESPAWN_INVINCIBLE_FRAMES 120

#define HITBOX_LEFT 3
#define HITBOX_RIGHT 12
#define HITBOX_TOP 2
#define SPRITE_SIZE 16

s16 player_x;
s16 player_y;
s8 player_velocity_y;
u8 player_on_ground;
u8 player_facing_left;
u8 player_invincible;

static s8 velocity_x;
static u8 coyote_frames;
static u8 jump_buffer;
static u8 cloud_drop;
static u8 walk_distance;

static u8 x;
static u8 y;

static void read_position(void) {
  x = (u8)(player_x >> SUBPIXEL_SHIFT);
  y = (u8)(player_y >> SUBPIXEL_SHIFT);
}

u8 player_pixel_x(void) {
  return (u8)(player_x >> SUBPIXEL_SHIFT);
}

u8 player_pixel_y(void) {
  return (u8)(player_y >> SUBPIXEL_SHIFT);
}

void player_spawn(void) {
  player_x = (s16)player_start_x << SUBPIXEL_SHIFT;
  player_y = (s16)player_start_y << SUBPIXEL_SHIFT;
  velocity_x = 0;
  player_velocity_y = 0;
  player_on_ground = 0;
  player_facing_left = 0;
  player_invincible = RESPAWN_INVINCIBLE_FRAMES;
  coyote_frames = 0;
  jump_buffer = 0;
  cloud_drop = 0;
  player_platform = NO_PLATFORM;
}

void player_bounce(void) {
  player_velocity_y = (pad_held & PAD_A) ? JUMP_VELOCITY : BOUNCE_VELOCITY;
  player_on_ground = 0;
}

static u8 is_solid(u8 at_x, u8 at_y) {
  u8 cell = cell_at(at_x, at_y);
  return cell == CELL_SOLID || cell == CELL_SPRING;
}

static void move_horizontally(void) {
  s8 target = 0;
  s8 top_speed = (pad_held & PAD_B) ? RUN_SPEED : WALK_SPEED;
  s8 acceleration = player_on_ground ? GROUND_ACCELERATION : AIR_ACCELERATION;

  if (pad_held & PAD_LEFT) {
    target = -top_speed;
    player_facing_left = 1;
  } else if (pad_held & PAD_RIGHT) {
    target = top_speed;
    player_facing_left = 0;
  }

  if (velocity_x < target) {
    velocity_x += acceleration;
    if (velocity_x > target) velocity_x = target;
  } else if (velocity_x > target) {
    velocity_x -= acceleration;
    if (velocity_x < target) velocity_x = target;
  }

  player_x += velocity_x;
  if (player_x < ((s16)SCREEN_LEFT << SUBPIXEL_SHIFT)) {
    player_x = (s16)SCREEN_LEFT << SUBPIXEL_SHIFT;
    velocity_x = 0;
  } else if (player_x > ((s16)SCREEN_RIGHT << SUBPIXEL_SHIFT)) {
    player_x = (s16)SCREEN_RIGHT << SUBPIXEL_SHIFT;
    velocity_x = 0;
  }

  read_position();
  if (velocity_x < 0 && (is_solid(x + HITBOX_LEFT, y + HITBOX_TOP) || is_solid(x + HITBOX_LEFT, y + SPRITE_SIZE - 1))) {
    player_x = (s16)(((x + HITBOX_LEFT) & 0xF0) + CELL_SIZE - HITBOX_LEFT) << SUBPIXEL_SHIFT;
    velocity_x = 0;
  } else if (velocity_x > 0 &&
             (is_solid(x + HITBOX_RIGHT, y + HITBOX_TOP) || is_solid(x + HITBOX_RIGHT, y + SPRITE_SIZE - 1))) {
    player_x = (s16)(((x + HITBOX_RIGHT) & 0xF0) - HITBOX_RIGHT - 1) << SUBPIXEL_SHIFT;
    velocity_x = 0;
  }
}

/** Standing on a cloud (fixed or moving) rather than on solid ground, so Down can drop through. */
static u8 standing_on_cloud(void) {
  u8 left_cell;
  u8 right_cell;
  if (!player_on_ground) return 0;
  if (player_platform != NO_PLATFORM) return 1;
  left_cell = cell_at(x + HITBOX_LEFT, y + SPRITE_SIZE);
  right_cell = cell_at(x + HITBOX_RIGHT, y + SPRITE_SIZE);
  if (is_solid(x + HITBOX_LEFT, y + SPRITE_SIZE) || is_solid(x + HITBOX_RIGHT, y + SPRITE_SIZE)) return 0;
  return left_cell == CELL_CLOUD || right_cell == CELL_CLOUD;
}

static void drop_through_cloud(void) {
  cloud_drop = CLOUD_DROP_FRAMES;
  player_on_ground = 0;
  jump_buffer = 0;
  coyote_frames = 0;
}

static void handle_jump(void) {
  if ((pad_pressed & PAD_DOWN) && standing_on_cloud()) {
    drop_through_cloud();
    return;
  }

  if (pad_pressed & PAD_A) jump_buffer = JUMP_BUFFER_FRAMES;
  else if (jump_buffer) --jump_buffer;

  if (player_on_ground) coyote_frames = COYOTE_FRAMES;
  else if (coyote_frames) --coyote_frames;

  if (!jump_buffer || !coyote_frames) return;

  if ((pad_held & PAD_DOWN) && standing_on_cloud()) {
    drop_through_cloud();
    return;
  }
  jump_buffer = 0;
  coyote_frames = 0;
  player_velocity_y = JUMP_VELOCITY;
  sfx_play(SFX_JUMP);
  player_on_ground = 0;
}

static void move_vertically(void) {
  u8 previous_feet;
  u8 feet;
  u8 left_cell;
  u8 right_cell;
  u8 surface;
  u8 platform;

  read_position();
  previous_feet = y + SPRITE_SIZE;

  player_velocity_y += (player_velocity_y < 0 && (pad_held & PAD_A)) ? JUMP_HOLD_GRAVITY : GRAVITY;
  if (player_velocity_y > MAX_FALL_SPEED) player_velocity_y = MAX_FALL_SPEED;

  player_y += player_velocity_y;
  if (player_y < 0) {
    player_y = 0;
    player_velocity_y = 0;
  }

  read_position();
  player_on_ground = 0;
  player_platform = NO_PLATFORM;
  if (cloud_drop) --cloud_drop;

  if (player_velocity_y < 0) {
    if (is_solid(x + HITBOX_LEFT, y + HITBOX_TOP) || is_solid(x + HITBOX_RIGHT, y + HITBOX_TOP)) {
      player_y = (s16)(((y + HITBOX_TOP) & 0xF0) + CELL_SIZE - HITBOX_TOP) << SUBPIXEL_SHIFT;
      player_velocity_y = 0;
    }
    return;
  }

  if (y >= MAP_ROWS * CELL_SIZE - SPRITE_SIZE) return;

  feet = y + SPRITE_SIZE;
  surface = feet & 0xF0;
  left_cell = cell_at(x + HITBOX_LEFT, feet);
  right_cell = cell_at(x + HITBOX_RIGHT, feet);

  if (left_cell == CELL_SPRING || right_cell == CELL_SPRING) {
    player_y = (s16)(surface - SPRITE_SIZE) << SUBPIXEL_SHIFT;
    player_velocity_y = SPRING_VELOCITY;
    sfx_play(SFX_SPRING);
    return;
  }

  if (left_cell == CELL_SOLID || right_cell == CELL_SOLID ||
      (!cloud_drop && (left_cell == CELL_CLOUD || right_cell == CELL_CLOUD) && previous_feet <= surface)) {
    player_y = (s16)(surface - SPRITE_SIZE) << SUBPIXEL_SHIFT;
    player_velocity_y = 0;
    player_on_ground = 1;
    return;
  }

  if (cloud_drop) return;
  platform = platform_landing(x, previous_feet, feet);
  if (platform != NO_PLATFORM) {
    player_y = (s16)(platform_top(platform) - SPRITE_SIZE) << SUBPIXEL_SHIFT;
    player_velocity_y = 0;
    player_on_ground = 1;
    player_platform = platform;
  }
}

/** Ice spikes fill the lower part of their cell; touching them there hurts. */
static u8 is_spike_point(u8 at_x, u8 at_y) {
  return cell_at(at_x, at_y) == CELL_SPIKES && (at_y & 0x0F) >= 6;
}

u8 player_touching_spikes(void) {
  read_position();
  if (y >= MAP_ROWS * CELL_SIZE - SPRITE_SIZE) return 0;
  return is_spike_point(x + HITBOX_LEFT + 1, y + SPRITE_SIZE - 1) ||
         is_spike_point(x + HITBOX_RIGHT - 1, y + SPRITE_SIZE - 1) || is_spike_point(x + 8, y + 8);
}

void player_update(void) {
  if (player_invincible) --player_invincible;
  read_position();
  handle_jump();
  move_horizontally();
  move_vertically();

  walk_distance += velocity_x < 0 ? -velocity_x : velocity_x;
}

u8 player_fell_off(void) {
  return player_y > ((s16)SCREEN_BOTTOM << SUBPIXEL_SHIFT);
}

void player_draw(void) {
  u8 tile = SPR_CLAUDE_STAND;
  u8 attributes = SPRITE_PALETTE_CLAUDE | (player_facing_left ? SPRITE_FLIP_X : 0);

  // Blink while invincible after respawning
  if (player_invincible && (frame_counter & 2)) return;

  if (!player_on_ground) tile = SPR_CLAUDE_JUMP;
  else if (velocity_x != 0) tile = (walk_distance & 0x80) ? SPR_CLAUDE_WALK_1 : SPR_CLAUDE_WALK_2;

  read_position();
  oam_meta_2x2(x, y, tile, attributes);
}

/** Moves Claude along the knocked-out arc; returns 1 once it has fallen off the screen. */
u8 player_update_hurt(void) {
  player_velocity_y += GRAVITY;
  if (player_velocity_y > MAX_FALL_SPEED) player_velocity_y = MAX_FALL_SPEED;
  player_y += player_velocity_y;
  return player_fell_off();
}

void player_draw_hurt(void) {
  // Above the top edge right after the hit, or already gone below the bottom
  if (player_y < 0 || player_fell_off()) return;

  read_position();
  oam_meta_2x2(x, y, SPR_CLAUDE_JUMP, SPRITE_PALETTE_HURT | (player_facing_left ? SPRITE_FLIP_X : 0));
}

void player_start_hurt(void) {
  player_velocity_y = JUMP_VELOCITY;
}
