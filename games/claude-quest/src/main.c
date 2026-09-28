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

static u8 state;
static u16 state_timer;
static char level_title[] = "LEVEL 0";

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
  level_title[6] = '1' + current_level;
  text_queue_centered(MESSAGE_ROW, level_title);
  text_queue_centered(MESSAGE_ROW + 1, level_name(current_level));
  music_play(SONG_LEVEL);
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

  player_update();
  bugs_update();
  tokens_update();

  if (player_fell_off() || bugs_check_player() == 2) {
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
  music_play(SONG_LEVEL);
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
  bugs_draw(reverse);
  tokens_draw(reverse);
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

    audio_update();
    ppu_wait_nmi();
  }
}
