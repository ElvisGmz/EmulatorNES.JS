#include "game.h"
#include "assets.h"
#include "audio.h"

// Stars Claude throws at bosses with B: straight ahead, diagonally with Up + a direction,
// or straight up with Up alone
#define MAX_SHOTS 2
#define SHOT_SPEED 64
#define SHOT_DIAGONAL_SPEED 44
#define SHOT_LIFETIME 50
#define SUBPIXEL_SHIFT 4

u8 star_ammo;

static u8 shot_timer[MAX_SHOTS];
static s16 shot_x[MAX_SHOTS];
static s16 shot_y[MAX_SHOTS];
static s8 shot_dx[MAX_SHOTS];
static s8 shot_dy[MAX_SHOTS];

static u8 index;

void shots_reset(void) {
  for (index = 0; index < MAX_SHOTS; ++index) shot_timer[index] = 0;
}

static void throw_star(void) {
  s8 forward;

  for (index = 0; index < MAX_SHOTS && shot_timer[index]; ++index) {
  }
  if (index == MAX_SHOTS) return;

  forward = player_facing_left ? -SHOT_SPEED : SHOT_SPEED;
  shot_dx[index] = forward;
  shot_dy[index] = 0;
  if (pad_held & PAD_UP) {
    if (pad_held & (PAD_LEFT | PAD_RIGHT)) {
      shot_dx[index] = player_facing_left ? -SHOT_DIAGONAL_SPEED : SHOT_DIAGONAL_SPEED;
      shot_dy[index] = -SHOT_DIAGONAL_SPEED;
    } else {
      shot_dx[index] = 0;
      shot_dy[index] = -SHOT_SPEED;
    }
  }

  shot_x[index] = player_x + ((s16)4 << SUBPIXEL_SHIFT);
  shot_y[index] = player_y + ((s16)4 << SUBPIXEL_SHIFT);
  shot_timer[index] = SHOT_LIFETIME;
  --star_ammo;
  hud_refresh_ammo();
  sfx_play(SFX_THROW);
}

void shots_update(void) {
  u8 x;
  u8 y;

  if ((pad_pressed & PAD_B) && star_ammo) throw_star();

  for (index = 0; index < MAX_SHOTS; ++index) {
    if (!shot_timer[index]) continue;
    shot_x[index] += shot_dx[index];
    shot_y[index] += shot_dy[index];
    x = (u8)(shot_x[index] >> SUBPIXEL_SHIFT);
    y = (u8)(shot_y[index] >> SUBPIXEL_SHIFT);
    --shot_timer[index];
    if (shot_x[index] < ((s16)SCREEN_LEFT << SUBPIXEL_SHIFT) ||
        shot_x[index] > ((s16)(SCREEN_RIGHT + 8) << SUBPIXEL_SHIFT) || shot_y[index] < ((s16)16 << SUBPIXEL_SHIFT) ||
        cell_at(x + 4, y + 4) == CELL_SOLID || boss_hit_by_star(x, y)) {
      shot_timer[index] = 0;
    }
  }
}

void shots_draw(void) {
  for (index = 0; index < MAX_SHOTS; ++index) {
    if (!shot_timer[index]) continue;
    oam_sprite((u8)(shot_x[index] >> SUBPIXEL_SHIFT), (u8)(shot_y[index] >> SUBPIXEL_SHIFT),
               SPR_THROWN_STAR, SPRITE_PALETTE_SPARKLE);
  }
}
