#include "game.h"
#include "assets.h"
#include "audio.h"

// Two bosses share one state machine. Every attack is telegraphed (the boss flashes
// before it commits) and every attack leaves an opening, souls-style.
#define STATE_GONE 0
#define STATE_IDLE 1
#define STATE_WINDUP 2
#define STATE_CHARGE 3
#define STATE_JUMP 4
#define STATE_STUNNED 5
#define STATE_TELEPORT_OUT 6
#define STATE_TELEPORT_IN 7
#define STATE_DIVE 8
#define STATE_RISE 9
#define STATE_DYING 10

#define ATTACK_CHARGE 0
#define ATTACK_JUMP 1
#define ATTACK_SUMMON 2
#define ATTACK_SHOOT 3
#define ATTACK_DIVE 4
#define ATTACK_TELEPORT 5
#define PATTERN_END 0xFF

#define BOSS_SIZE 32
#define LEFT_LIMIT 8
#define RIGHT_LIMIT 216
#define GROUND_Y 176
#define SEGFAULT_HOME_Y 56
#define SUBPIXEL_SHIFT 4

#define KING_BUG_HEALTH 12
#define SEGFAULT_HEALTH 16
#define HIT_FLASH_FRAMES 10
#define DYING_FRAMES 120
#define STOMP_DAMAGE 2

#define KING_GRAVITY 6
#define KING_JUMP_VELOCITY -96

#define MAX_PROJECTILES 6
#define PROJECTILE_ORB 0
#define PROJECTILE_WAVE 1
#define ORB_SPEED 22
#define WAVE_SPEED 32
#define WAVE_SPEED_ENRAGED 44

// Collision box inside the 32x32 boss sprite
#define BOX_LEFT 4
#define BOX_RIGHT 27
#define KING_BOX_TOP 12
#define SEGFAULT_BOX_TOP 4
#define BOX_BOTTOM 30
#define PLAYER_LEFT 3
#define PLAYER_RIGHT 12
#define PLAYER_TOP 3
#define PLAYER_BOTTOM 15
#define STOMP_DEPTH 10
#define CROWN_TOP 6
#define CROWN_LEFT 12
#define CROWN_LEFT_FLIPPED 4

// Attack cycles; the second half of each boss's health uses the enraged cycle
static const u8 king_pattern[] = {ATTACK_CHARGE, ATTACK_JUMP, ATTACK_CHARGE, ATTACK_JUMP, ATTACK_JUMP, PATTERN_END};
static const u8 king_pattern_enraged[] = {ATTACK_JUMP, ATTACK_CHARGE, ATTACK_SUMMON, ATTACK_JUMP,
                                          ATTACK_JUMP, ATTACK_CHARGE, PATTERN_END};
static const u8 segfault_pattern[] = {ATTACK_SHOOT, ATTACK_SHOOT, ATTACK_DIVE, ATTACK_TELEPORT, ATTACK_SHOOT,
                                      ATTACK_DIVE, PATTERN_END};
static const u8 segfault_pattern_enraged[] = {ATTACK_TELEPORT, ATTACK_SHOOT, ATTACK_DIVE, ATTACK_SHOOT,
                                              ATTACK_TELEPORT, ATTACK_DIVE, PATTERN_END};
static const u8 teleport_spots[4] = {24, 184, 104, 56};

static const s8 hover_wave[16] = {0, 2, 4, 5, 6, 5, 4, 2, 0, -2, -4, -5, -6, -5, -4, -2};

u8 boss_health;
u8 boss_max_health;

static u8 boss_type;
static u8 state;
static u8 timer;
static u8 attack;
static u8 pattern_step;
static u8 enraged;
static u8 hit_flash;
static u8 facing_left;
static u8 x;
static u8 y;
static u8 subpixel;
static s16 y_position;
static s8 velocity_y;
static s8 velocity_x;
static u8 target_x;
static u8 hover_phase;
static u8 teleport_index;

static u8 projectile_count;
static u8 projectile_kind[MAX_PROJECTILES];
static s16 projectile_x[MAX_PROJECTILES];
static s16 projectile_y[MAX_PROJECTILES];
static s8 projectile_dx[MAX_PROJECTILES];
static s8 projectile_dy[MAX_PROJECTILES];

static u8 box_top;
static u8 index;
static u8 px;
static u8 py;

static void clear_projectiles(void) {
  projectile_count = 0;
}

static void add_projectile(u8 kind, u8 at_x, u8 at_y, s8 dx, s8 dy) {
  if (projectile_count == MAX_PROJECTILES) return;
  projectile_kind[projectile_count] = kind;
  projectile_x[projectile_count] = (s16)at_x << SUBPIXEL_SHIFT;
  projectile_y[projectile_count] = (s16)at_y << SUBPIXEL_SHIFT;
  projectile_dx[projectile_count] = dx;
  projectile_dy[projectile_count] = dy;
  ++projectile_count;
}

static void remove_projectile(void) {
  --projectile_count;
  projectile_kind[index] = projectile_kind[projectile_count];
  projectile_x[index] = projectile_x[projectile_count];
  projectile_y[index] = projectile_y[projectile_count];
  projectile_dx[index] = projectile_dx[projectile_count];
  projectile_dy[index] = projectile_dy[projectile_count];
}

void boss_spawn(u8 type, u8 at_x) {
  boss_type = type;
  enraged = 0;
  pattern_step = 0;
  hit_flash = 0;
  teleport_index = 0;
  hover_phase = 0;
  subpixel = 0;
  clear_projectiles();

  // The level marks the boss's bottom-right 16x16 cell
  x = at_x - CELL_SIZE;
  if (type == BOSS_KING_BUG) {
    boss_max_health = KING_BUG_HEALTH;
    box_top = KING_BOX_TOP;
    y = GROUND_Y;
    facing_left = 1;
  } else {
    boss_max_health = SEGFAULT_HEALTH;
    box_top = SEGFAULT_BOX_TOP;
    y = SEGFAULT_HOME_Y;
    facing_left = 0;
  }
  boss_health = boss_max_health;
  y_position = (s16)y << SUBPIXEL_SHIFT;
  state = STATE_IDLE;
  timer = 90;
}

static u8 center_x(void) {
  return x + (BOSS_SIZE >> 1);
}

static void face_player(void) {
  facing_left = px + 8 < center_x();
}

static u8 next_attack(void) {
  const u8 *pattern;
  if (boss_type == BOSS_KING_BUG) pattern = enraged ? king_pattern_enraged : king_pattern;
  else pattern = enraged ? segfault_pattern_enraged : segfault_pattern;

  if (pattern[pattern_step] == PATTERN_END) pattern_step = 0;
  return pattern[pattern_step++];
}

static void go_idle(u8 frames) {
  state = STATE_IDLE;
  timer = enraged ? frames >> 1 : frames;
}

static void start_windup(void) {
  attack = next_attack();
  face_player();
  state = STATE_WINDUP;
  timer = enraged ? 26 : 40;
  if (attack == ATTACK_TELEPORT) {
    state = STATE_TELEPORT_OUT;
    timer = 30;
    return;
  }
  if (attack == ATTACK_DIVE) timer += 10;
  sfx_play(SFX_WARN);
}

/** Moves toward `target_x` at `speed` sixteenths of a pixel per frame; returns 1 when there. */
static u8 walk_toward_target(u8 speed) {
  subpixel += speed;
  while (subpixel >= 16) {
    subpixel -= 16;
    if (x < target_x) ++x;
    else if (x > target_x) --x;
  }
  return x == target_x;
}

// King Bug ------------------------------------------------------------------

static void king_jump(void) {
  s16 distance = (s16)px - 8 - (s16)x;
  velocity_y = KING_JUMP_VELOCITY;
  // The jump lasts 32 frames, so half the distance per frame (in 1/16 px) lands where Claude stood
  velocity_x = (s8)(distance / 2);
  subpixel = 0;
  state = STATE_JUMP;
}

static void king_land(void) {
  y = GROUND_Y;
  y_position = (s16)GROUND_Y << SUBPIXEL_SHIFT;
  sfx_play(SFX_EXPLODE);
  add_projectile(PROJECTILE_WAVE, x, GROUND_Y + 24, enraged ? -WAVE_SPEED_ENRAGED : -WAVE_SPEED, 0);
  add_projectile(PROJECTILE_WAVE, x + 24, GROUND_Y + 24, enraged ? WAVE_SPEED_ENRAGED : WAVE_SPEED, 0);
  go_idle(50);
}

static void king_update(void) {
  switch (state) {
    case STATE_IDLE:
      face_player();
      target_x = facing_left ? LEFT_LIMIT : RIGHT_LIMIT;
      walk_toward_target(enraged ? 16 : 10);
      if (--timer == 0) start_windup();
      break;
    case STATE_WINDUP:
      if (--timer) break;
      if (attack == ATTACK_CHARGE) {
        state = STATE_CHARGE;
      } else if (attack == ATTACK_JUMP) {
        king_jump();
      } else {
        // Summon: two minions crawl in from the edges while the king roars
        if (bugs_alive() < 2) {
          bug_add(LEFT_LIMIT, GROUND_Y + CELL_SIZE, 0, 0);
          bug_add(RIGHT_LIMIT + CELL_SIZE, GROUND_Y + CELL_SIZE, 1, 0);
        }
        go_idle(60);
      }
      break;
    case STATE_CHARGE:
      target_x = facing_left ? LEFT_LIMIT : RIGHT_LIMIT;
      if (walk_toward_target(enraged ? 72 : 56)) {
        sfx_play(SFX_EXPLODE);
        state = STATE_STUNNED;
        timer = enraged ? 70 : 100;
      }
      break;
    case STATE_JUMP:
      velocity_y += KING_GRAVITY;
      y_position += velocity_y;
      subpixel += velocity_x < 0 ? -velocity_x : velocity_x;
      while (subpixel >= 16) {
        subpixel -= 16;
        if (velocity_x < 0 && x > LEFT_LIMIT) --x;
        else if (velocity_x > 0 && x < RIGHT_LIMIT) ++x;
      }
      y = (u8)(y_position >> SUBPIXEL_SHIFT);
      if (velocity_y > 0 && y >= GROUND_Y) king_land();
      break;
    case STATE_STUNNED:
      if (--timer == 0) go_idle(30);
      break;
  }
}

// The Segfault ----------------------------------------------------------------

/** Fires orbs at Claude: a 3-way spread, 5-way once enraged. */
static void segfault_shoot(void) {
  s16 dx = (s16)px + 4 - (s16)center_x();
  s16 dy = (s16)py + 4 - (s16)(y + 20);
  s16 longest = dx < 0 ? -dx : dx;
  s16 other = dy < 0 ? -dy : dy;
  s8 aim_x;
  s8 aim_y;
  u8 from_x = center_x() - 4;
  u8 from_y = y + 20;

  if (other > longest) longest = other;
  if (longest == 0) longest = 1;
  aim_x = (s8)(dx * ORB_SPEED / longest);
  aim_y = (s8)(dy * ORB_SPEED / longest);

  sfx_play(SFX_THROW);
  add_projectile(PROJECTILE_ORB, from_x, from_y, aim_x, aim_y);
  add_projectile(PROJECTILE_ORB, from_x, from_y, aim_x - (aim_y >> 1), aim_y + (aim_x >> 1));
  add_projectile(PROJECTILE_ORB, from_x, from_y, aim_x + (aim_y >> 1), aim_y - (aim_x >> 1));
  if (!enraged) return;
  add_projectile(PROJECTILE_ORB, from_x, from_y, aim_x - aim_y, aim_y + aim_x);
  add_projectile(PROJECTILE_ORB, from_x, from_y, aim_x + aim_y, aim_y - aim_x);
}

static void segfault_hover(void) {
  ++hover_phase;
  y = SEGFAULT_HOME_Y + hover_wave[(hover_phase >> 2) & 15];
}

static void segfault_update(void) {
  switch (state) {
    case STATE_IDLE:
      segfault_hover();
      target_x = px > 120 ? px - 72 : px + 40;
      if (target_x < LEFT_LIMIT) target_x = LEFT_LIMIT;
      if (target_x > RIGHT_LIMIT) target_x = RIGHT_LIMIT;
      walk_toward_target(enraged ? 20 : 12);
      if (--timer == 0) start_windup();
      break;
    case STATE_WINDUP:
      if (attack == ATTACK_DIVE) {
        // Lines up above Claude, then drops
        target_x = px > LEFT_LIMIT + 8 ? px - 8 : LEFT_LIMIT;
        if (target_x > RIGHT_LIMIT) target_x = RIGHT_LIMIT;
        if (timer > 12) walk_toward_target(40);
      }
      if (--timer) break;
      if (attack == ATTACK_SHOOT) {
        segfault_shoot();
        go_idle(70);
      } else {
        state = STATE_DIVE;
        velocity_y = 0;
        y_position = (s16)y << SUBPIXEL_SHIFT;
      }
      break;
    case STATE_DIVE:
      if (velocity_y < 64) velocity_y += 6;
      y_position += velocity_y;
      y = (u8)(y_position >> SUBPIXEL_SHIFT);
      if (y >= GROUND_Y) {
        y = GROUND_Y;
        sfx_play(SFX_EXPLODE);
        state = STATE_STUNNED;
        timer = enraged ? 60 : 90;
      }
      break;
    case STATE_STUNNED:
      if (--timer == 0) state = STATE_RISE;
      break;
    case STATE_RISE:
      y -= 2;
      if (y <= SEGFAULT_HOME_Y) {
        y = SEGFAULT_HOME_Y;
        hover_phase = 0;
        go_idle(40);
      }
      break;
    case STATE_TELEPORT_OUT:
      if (--timer) break;
      teleport_index = (teleport_index + 1 + (frame_counter & 1)) & 3;
      x = teleport_spots[teleport_index];
      state = STATE_TELEPORT_IN;
      timer = 30;
      break;
    case STATE_TELEPORT_IN:
      segfault_hover();
      if (--timer) break;
      if (enraged) {
        attack = ATTACK_SHOOT;
        state = STATE_WINDUP;
        timer = 20;
        sfx_play(SFX_WARN);
      } else {
        go_idle(50);
      }
      break;
  }
}

// Shared ----------------------------------------------------------------------

static void update_projectiles(void) {
  u8 at_x;
  u8 at_y;
  index = 0;
  while (index < projectile_count) {
    projectile_x[index] += projectile_dx[index];
    projectile_y[index] += projectile_dy[index];
    at_x = (u8)(projectile_x[index] >> SUBPIXEL_SHIFT);
    at_y = (u8)(projectile_y[index] >> SUBPIXEL_SHIFT);
    if (projectile_x[index] < ((s16)LEFT_LIMIT << SUBPIXEL_SHIFT) ||
        projectile_x[index] > ((s16)(SCREEN_RIGHT + 8) << SUBPIXEL_SHIFT) ||
        projectile_y[index] < ((s16)24 << SUBPIXEL_SHIFT) || cell_at(at_x + 4, at_y + 4) == CELL_SOLID) {
      remove_projectile();
      continue;
    }
    ++index;
  }
}

void boss_update(void) {
  if (state == STATE_GONE) return;
  px = player_pixel_x();
  py = player_pixel_y();
  if (hit_flash) --hit_flash;
  update_projectiles();

  if (state == STATE_DYING) {
    if ((timer & 15) == 0) sfx_play(SFX_EXPLODE);
    if (--timer == 0) state = STATE_GONE;
    return;
  }

  if (boss_type == BOSS_KING_BUG) king_update();
  else segfault_update();
}

static u8 overlaps_player(u8 left, u8 top, u8 right, u8 bottom) {
  if (px + PLAYER_RIGHT < left || px + PLAYER_LEFT > right) return 0;
  return py + PLAYER_BOTTOM >= top && py + PLAYER_TOP <= bottom;
}

static u8 is_hidden(void) {
  return state == STATE_TELEPORT_OUT || state == STATE_TELEPORT_IN || state == STATE_DYING || state == STATE_GONE;
}

static void take_damage(u8 amount) {
  hit_flash = HIT_FLASH_FRAMES;
  score_add(SCORE_BOSS_HIT);
  if (boss_health <= amount) {
    boss_health = 0;
    state = STATE_DYING;
    timer = DYING_FRAMES;
    clear_projectiles();
  } else {
    boss_health -= amount;
    sfx_play(SFX_BOSS_HIT);
    if (!enraged && boss_health <= (boss_max_health >> 1)) {
      enraged = 1;
      pattern_step = 0;
    }
  }
  hud_refresh_boss();
}

/** Returns 1 when the boss or one of its projectiles hits Claude (stomping a stunned boss is safe). */
u8 boss_hurts_player(void) {
  px = player_pixel_x();
  py = player_pixel_y();

  if (!is_hidden() && overlaps_player(x + BOX_LEFT, y + box_top, x + BOX_RIGHT, y + BOX_BOTTOM)) {
    if (state == STATE_STUNNED) {
      if (player_velocity_y > 0 && py + PLAYER_BOTTOM < y + box_top + STOMP_DEPTH) {
        player_bounce();
        sfx_play(SFX_STOMP);
        if (!hit_flash) take_damage(STOMP_DAMAGE);
      }
    } else if (!player_invincible) {
      return 1;
    }
  }

  if (player_invincible) return 0;
  for (index = 0; index < projectile_count; ++index) {
    u8 at_x = (u8)(projectile_x[index] >> SUBPIXEL_SHIFT);
    u8 at_y = (u8)(projectile_y[index] >> SUBPIXEL_SHIFT);
    if (overlaps_player(at_x + 2, at_y + 2, at_x + 5, at_y + 7)) return 1;
  }
  return 0;
}

/** Called for each thrown star at its top-left corner; returns 1 when the boss absorbs it. */
u8 boss_hit_by_star(u8 star_x, u8 star_y) {
  if (is_hidden()) return 0;
  star_x += 4;
  star_y += 4;
  if (star_x < x + BOX_LEFT || star_x > x + BOX_RIGHT || star_y < y + box_top - 4 || star_y > y + BOX_BOTTOM) {
    return 0;
  }
  if (!hit_flash) take_damage(1);
  return 1;
}

u8 boss_defeated(void) {
  return state == STATE_GONE;
}

const char *boss_name(void) {
  return boss_type == BOSS_KING_BUG ? "KING BUG" : "SEGFAULT";
}

void boss_draw(void) {
  u8 palette = boss_type == BOSS_KING_BUG ? SPRITE_PALETTE_BUG : SPRITE_PALETTE_PLATFORM;
  u8 tile;
  u16 mask;

  for (index = 0; index < projectile_count; ++index) {
    oam_sprite((u8)(projectile_x[index] >> SUBPIXEL_SHIFT), (u8)(projectile_y[index] >> SUBPIXEL_SHIFT),
               projectile_kind[index] == PROJECTILE_ORB ? SPR_BULLET : SPR_SHOCKWAVE,
               projectile_kind[index] == PROJECTILE_ORB ? SPRITE_PALETTE_SPARKLE : SPRITE_PALETTE_PLATFORM);
  }

  if (state == STATE_GONE) return;
  if ((state == STATE_TELEPORT_OUT || state == STATE_TELEPORT_IN || state == STATE_DYING) && (frame_counter & 2)) {
    return;
  }

  if (hit_flash || state == STATE_DYING || (state == STATE_WINDUP && (frame_counter & 4))) {
    palette = SPRITE_PALETTE_HURT;
  }

  if (boss_type == BOSS_KING_BUG) {
    if (state == STATE_STUNNED || (x & 8)) {
      tile = SPR_KING_BUG_2;
      mask = MASK_KING_BUG_2;
    } else {
      tile = SPR_KING_BUG_1;
      mask = MASK_KING_BUG_1;
    }
    // The bug art faces left
    if (facing_left) {
      oam_sprite(x + CROWN_LEFT, y + CROWN_TOP, SPR_KING_CROWN, SPRITE_PALETTE_SPARKLE);
      oam_sprite(x + CROWN_LEFT + 8, y + CROWN_TOP, SPR_KING_CROWN + 1, SPRITE_PALETTE_SPARKLE);
    } else {
      oam_sprite(x + CROWN_LEFT_FLIPPED, y + CROWN_TOP, SPR_KING_CROWN + 1, SPRITE_PALETTE_SPARKLE | SPRITE_FLIP_X);
      oam_sprite(x + CROWN_LEFT_FLIPPED + 8, y + CROWN_TOP, SPR_KING_CROWN, SPRITE_PALETTE_SPARKLE | SPRITE_FLIP_X);
    }
    oam_meta_4x4(x, y, tile, palette | (facing_left ? 0 : SPRITE_FLIP_X), mask);
    return;
  }

  if (frame_counter & 16) {
    tile = SPR_SEGFAULT_2;
    mask = MASK_SEGFAULT_2;
  } else {
    tile = SPR_SEGFAULT_1;
    mask = MASK_SEGFAULT_1;
  }
  oam_meta_4x4(x, y, tile, palette, mask);
}
