#ifndef GAME_H
#define GAME_H

#include "nes.h"

// The level is a 16x15 grid of 16x16 cells; row 1 holds the HUD and row 2 is kept
// clear for messages, so level strings describe rows 2-14.
#define MAP_COLUMNS 16
#define MAP_ROWS 15
#define LEVEL_FIRST_ROW 2
#define LEVEL_ROWS 13
#define CELL_SIZE 16

#define CELL_EMPTY 0
#define CELL_SOLID 1
#define CELL_CLOUD 2
#define CELL_TOKEN 3
#define CELL_SPRING 4
#define CELL_SPIKES 5
// Invisible turnaround point for moving platforms
#define CELL_MARKER 6

#define PALETTE_GROUND 0
#define PALETTE_CLOUD 1
#define PALETTE_TEXT 2
#define PALETTE_SKY 3

#define SPRITE_PALETTE_CLAUDE 0
#define SPRITE_PALETTE_BUG 1
#define SPRITE_PALETTE_SPARKLE 2
#define SPRITE_PALETTE_HURT 2
#define SPRITE_PALETTE_PLATFORM 3

#define MESSAGE_ROW 4
#define HUD_ROW 2

// Visible area once the emulator crops the 8px overscan border
#define SCREEN_LEFT 8
#define SCREEN_RIGHT 232
#define SCREEN_BOTTOM 232

#define MAX_BUGS 5
#define MAX_TOKENS 10
#define MAX_PLATFORMS 3
#define NO_PLATFORM 0xFF
#define LEVEL_COUNT 12
// Levels from this index on are the hard ones, with their own music
#define FIRST_HARD_LEVEL 6

#define BOSS_NONE 0
#define BOSS_KING_BUG 1
#define BOSS_SEGFAULT 2
#define MAX_STAR_AMMO 5
#define STARTING_LIVES 3

#define SCORE_TOKEN 5
#define SCORE_BUG 10
#define SCORE_BOSS_HIT 5
#define SCORE_BOSS 100
#define SCORE_PER_EXTRA_LIFE 200

// level.c
extern u8 level_map[MAP_COLUMNS * MAP_ROWS];
extern u8 current_level;
extern u8 player_start_x;
extern u8 player_start_y;
extern u8 bug_speed;
u8 cell_at(u8 x, u8 y);
u8 cell_is_floor(u8 cell);
void level_erase_cell(u8 x, u8 y);
void level_load(u8 level);
void level_draw(void);
void sky_draw(u8 ground_row, u16 text_row_mask);
const char *level_name(u8 level);
u8 level_number(u8 level);
u8 level_boss(u8 level);
void level_draw_token_cell(u8 x, u8 y);

// player.c
extern s16 player_x;
extern s16 player_y;
extern s8 player_velocity_y;
extern u8 player_on_ground;
extern u8 player_facing_left;
extern u8 player_invincible;
void player_spawn(void);
void player_update(void);
void player_draw(void);
void player_bounce(void);
u8 player_fell_off(void);
void player_start_hurt(void);
u8 player_touching_spikes(void);
u8 player_update_hurt(void);
void player_draw_hurt(void);
u8 player_pixel_x(void);
u8 player_pixel_y(void);

// bugs.c
extern u8 bug_count;
void bugs_reset(void);
void bug_add(u8 x, u8 y, u8 facing_left, u8 flying);
void bugs_update(void);
void bugs_draw(u8 reverse);
u8 bugs_check_player(void);
u8 bugs_alive(void);

// tokens.c
extern u8 tokens_left;
void tokens_reset(void);
void token_add(u8 x, u8 y);
void tokens_update(void);
void tokens_draw(void);
// In boss arenas tokens are star ammo and grow back after being picked up
void tokens_set_ammo_mode(u8 enabled);

// boss.c
extern u8 boss_health;
extern u8 boss_max_health;
void boss_spawn(u8 type, u8 x);
void boss_update(void);
void boss_draw(void);
u8 boss_hurts_player(void);
u8 boss_hit_by_star(u8 x, u8 y);
u8 boss_defeated(void);
const char *boss_name(void);

// shots.c
extern u8 star_ammo;
void shots_reset(void);
void shots_update(void);
void shots_draw(void);

// platforms.c
extern u8 platform_count;
extern u8 player_platform;
void platforms_reset(void);
void platform_add(u8 x, u8 y, u8 vertical);
void platforms_update(void);
void platforms_draw(u8 reverse);
void platforms_carry_player(void);
u8 platform_landing(u8 x, u8 previous_feet, u8 feet);
u8 platform_top(u8 index);

// hud.c
// Score is stored in tens, so a u16 can hold up to 655350 points
extern u16 score;
extern u8 lives;
void text_write(u8 column, u8 row, const char *text);
void text_queue(u8 column, u8 row, const char *text);
void text_queue_centered(u8 row, const char *text);
void text_clear_row(u8 row);
void hud_draw(void);
void hud_refresh_now(void);
void hud_refresh(void);
void score_reset(void);
void score_add(u8 tens);
void hud_refresh_boss(void);
void hud_refresh_ammo(void);

// screens.c
void title_draw(void);
void title_update(void);
void win_draw(void);
void win_update(void);

#endif
