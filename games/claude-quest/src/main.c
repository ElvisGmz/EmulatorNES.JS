#include "game.h"
#include "assets.h"
#include "audio.h"

#define STATE_TITLE 0
#define STATE_INTRO 1
#define STATE_PLAYING 2
#define STATE_PAUSED 3
#define STATE_HURT 4
#define STATE_CLEAR 5
#define STATE_GAME_OVER 6
#define STATE_WIN 7

#define INTRO_FRAMES 100
#define CLEAR_FRAMES 150
#define GAME_OVER_PROMPT_FRAMES 90
#define TWINKLE_FRAME_MASK 7
#define SKY_TWINKLE_PALETTE_INDEX 15

static u8 state;
static u16 state_timer;
static char level_title[] = "LEVEL 10";

static u8 level_song(void) {
  return current_level >= FIRST_HARD_LEVEL ? SONG_DANGER : SONG_LEVEL;
}

static void format_level_title(void) {
  u8 number = current_level + 1;
  if (number >= 10) {
    level_title[6] = '1';
    level_title[7] = '0' + number - 10;
  } else {
    level_title[6] = '0' + number;
    level_title[7] = 0;
  }
}

// Stars and tokens share the last sky color, so cycling it makes them all twinkle
static void twinkle_sky(void) {
  if (frame_counter & TWINKLE_FRAME_MASK) return;
  palette_buffer[SKY_TWINKLE_PALETTE_INDEX] = sky_twinkle_colors[(frame_counter >> 3) & (SKY_TWINKLE_COUNT - 1)];
  palette_dirty = 1;
}

static void enter_title(void) {
  ppu_off();
  oam_begin();
  oam_end();
  title_draw();
  ppu_on();
  music_play(SONG_TITLE);
  state = STATE_TITLE;
}

static void enter_level(void) {
  ppu_off();
  oam_begin();
  oam_end();
  level_load(current_level);
  level_draw();
  hud_draw();
  ppu_on();

  player_spawn();
  // Invincibility is only a grace period after losing a life, not at the start of a level
  player_invincible = 0;
  format_level_title();
  text_queue_centered(MESSAGE_ROW, level_title);
  text_queue_centered(MESSAGE_ROW + 1, level_name(current_level));
  music_play(level_song());
  state = STATE_INTRO;
  state_timer = INTRO_FRAMES;
}

static void enter_win(void) {
  ppu_off();
  oam_begin();
  oam_end();
  win_draw();
  ppu_on();
  music_play(SONG_WIN);
  state = STATE_WIN;
}

static void clear_messages(void) {
  text_clear_row(MESSAGE_ROW);
  text_clear_row(MESSAGE_ROW + 1);
}

static void update_intro(void) {
  if (--state_timer == 0) {
    clear_messages();
    state = STATE_PLAYING;
  }
}

static void start_hurt(void) {
  music_stop();
  sfx_play(SFX_HURT);
  player_start_hurt();
  state = STATE_HURT;
}

static void update_playing(void) {
  if (pad_pressed & PAD_START) {
    audio_set_paused(1);
    text_queue_centered(MESSAGE_ROW, "PAUSED");
    state = STATE_PAUSED;
    return;
  }

  platforms_update();
  platforms_carry_player();
  player_update();
  bugs_update();
  tokens_update();

  if (player_fell_off() || bugs_check_player() == 2 || (!player_invincible && player_touching_spikes())) {
    start_hurt();
    return;
  }

  if (tokens_left == 0) {
    music_play(SONG_CLEAR);
    text_queue_centered(MESSAGE_ROW, "LEVEL CLEAR!");
    state = STATE_CLEAR;
    state_timer = CLEAR_FRAMES;
  }
}

static void update_paused(void) {
  if (!(pad_pressed & PAD_START)) return;
  audio_set_paused(0);
  text_clear_row(MESSAGE_ROW);
  state = STATE_PLAYING;
}

static void update_hurt(void) {
  if (!player_update_hurt()) return;

  --lives;
  hud_refresh();
  if (lives == 0) {
    music_play(SONG_GAME_OVER);
    text_queue_centered(MESSAGE_ROW, "GAME OVER");
    state = STATE_GAME_OVER;
    state_timer = 0;
    return;
  }

  player_spawn();
  music_play(level_song());
  state = STATE_PLAYING;
}

static void update_clear(void) {
  if (--state_timer) return;

  if (current_level + 1 == LEVEL_COUNT) {
    enter_win();
    return;
  }
  ++current_level;
  enter_level();
}

static void update_game_over(void) {
  ++state_timer;
  if (state_timer == GAME_OVER_PROMPT_FRAMES) text_queue_centered(MESSAGE_ROW + 1, "PRESS START");
  if (state_timer > GAME_OVER_PROMPT_FRAMES && (pad_pressed & PAD_START)) enter_title();
}

static void draw_world(void) {
  u8 reverse = frame_counter & 1;

  // Claude is drawn first so it never flickers; enemies and tokens alternate order
  // every frame so the 8-sprites-per-line limit spreads the flicker between them
  if (state == STATE_HURT) player_draw_hurt();
  else if (state != STATE_GAME_OVER) player_draw();
  platforms_draw(reverse);
  bugs_draw(reverse);
  tokens_draw();
}

void main(void) {
  audio_init();
  ppu_off();
  palette_set(game_palette);
  enter_title();

  for (;;) {
    pad_poll();
    oam_begin();

    switch (state) {
      case STATE_TITLE:
        title_update();
        if (pad_pressed & PAD_START) {
          sfx_play(SFX_START);
          score_reset();
          current_level = 0;
          enter_level();
        }
        break;
      case STATE_INTRO:
        update_intro();
        break;
      case STATE_PLAYING:
        update_playing();
        break;
      case STATE_PAUSED:
        update_paused();
        break;
      case STATE_HURT:
        update_hurt();
        break;
      case STATE_CLEAR:
        update_clear();
        break;
      case STATE_GAME_OVER:
        update_game_over();
        break;
      case STATE_WIN:
        win_update();
        if (pad_pressed & PAD_START) enter_title();
        break;
    }

    if (state != STATE_TITLE && state != STATE_WIN) draw_world();
    oam_end();
    twinkle_sky();

    audio_update();
    ppu_wait_nmi();
  }
}
