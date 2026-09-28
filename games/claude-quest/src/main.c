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
#define STATE_DIED 8
#define STATE_TROLLED 9
#define STATE_FAKE_CLEAR 10

#define INTRO_FRAMES 100
#define CLEAR_FRAMES 150
#define GAME_OVER_PROMPT_FRAMES 90
#define DIED_FRAMES 150
#define TWINKLE_FRAME_MASK 7
#define SKY_TWINKLE_PALETTE_INDEX 15
// Troll levels: how long the taunt shows before the level starts over
#define TROLLED_FRAMES 90
// Fake clear: the clear jingle, then the punchline, then the hidden tokens one by one
#define FAKE_CLEAR_PUNCHLINE_FRAMES 100
#define FAKE_CLEAR_REVEAL_FRAMES 176
#define REVEAL_INTERVAL_MASK 7
#define MESSAGE_FRAMES 90
#define TAUNT_COUNT 8
#define MAX_TROLLED 255

static u8 state;
static u16 state_timer;
static char level_title[] = "LEVEL 10";

// "~" is the font's Ñ
static const char *const taunts[TAUNT_COUNT] = {
    "PERDONAME NI~ITA", "Y NO TENES EL MAX!?", "GOTCHA!",      "NICE TRY",
    "STILL TOO EASY?",  "LOL",                 "SKILL ISSUE", "TRUST NO ONE",
};

static u8 is_boss_level(void) {
  return level_boss(current_level) != BOSS_NONE;
}

static u8 is_troll_level(void) {
  return level_is_troll(current_level);
}

static u8 level_song(void) {
  if (is_boss_level()) return SONG_BOSS;
  return current_level >= FIRST_HARD_LEVEL ? SONG_DANGER : SONG_LEVEL;
}

static void format_level_title(void) {
  u8 number = level_number(current_level);
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

static void load_level(void) {
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
  star_ammo = 0;
  shots_reset();
  tokens_set_ammo_mode(is_boss_level());
  message_expire(0);
}

static void enter_level(void) {
  encore_played = 0;
  load_level();
  if (is_boss_level()) {
    text_queue_centered(MESSAGE_ROW, "BOSS FIGHT");
  } else {
    format_level_title();
    text_queue_centered(MESSAGE_ROW, level_title);
  }
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

/** Troll levels start over right away, traps and all, without the intro. */
static void restart_level(void) {
  load_level();
  music_play(level_song());
  state = STATE_PLAYING;
}

static void start_hurt(void) {
  music_stop();
  player_start_hurt();
  if (is_troll_level()) {
    if (times_trolled < MAX_TROLLED) ++times_trolled;
    sfx_play(SFX_TROLLED);
    state = STATE_TROLLED;
    state_timer = 0;
    return;
  }
  sfx_play(SFX_HURT);
  state = STATE_HURT;
}

static void start_fake_clear(void) {
  message_write(MESSAGE_ROW, "LEVEL CLEAR!");
  music_play(SONG_CLEAR);
  state = STATE_FAKE_CLEAR;
  state_timer = 0;
}

static void update_playing(void) {
  if (pad_pressed & PAD_START) {
    audio_set_paused(1);
    message_write(MESSAGE_ROW, "PAUSED");
    state = STATE_PAUSED;
    return;
  }

  // First, so clearing an old message always fits in this frame's VRAM queue
  message_update();
  platforms_update();
  platforms_carry_player();
  player_update();
  bugs_update();
  tokens_update();
  traps_update();
  if (is_boss_level()) {
    shots_update();
    boss_update();
  }

  if (player_fell_off() || bugs_check_player() == 2 || (!player_invincible && player_touching_spikes()) ||
      traps_hurt_player() || (is_boss_level() && boss_hurts_player())) {
    start_hurt();
    return;
  }

  if (is_boss_level()) {
    if (!boss_defeated()) return;
    // Minions fall with their king
    bugs_reset();
    shots_reset();
    score_add(SCORE_BOSS);
    message_write(MESSAGE_ROW, "GREAT ENEMY FELLED");
  } else {
    if (tokens_left) return;
    if (tokens_hidden_left()) {
      start_fake_clear();
      return;
    }
    message_write(MESSAGE_ROW, "LEVEL CLEAR!");
  }
  music_play(SONG_CLEAR);
  state = STATE_CLEAR;
  state_timer = CLEAR_FRAMES;
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

  // Bosses start over, with full health, every time Claude falls
  if (is_boss_level()) {
    music_play(SONG_GAME_OVER);
    text_queue_centered(MESSAGE_ROW, "YOU DIED");
    state = STATE_DIED;
    state_timer = DIED_FRAMES;
    return;
  }

  player_spawn();
  music_play(level_song());
  state = STATE_PLAYING;
}

/** A troll death: no life lost, just a taunt, one more on the counter and the level again. */
static void update_trolled(void) {
  u8 gone = player_update_hurt();
  // Written a frame after the hit, when the VRAM queue is empty
  if (state_timer == 0) {
    message_write(MESSAGE_ROW, taunts[(times_trolled - 1) & (TAUNT_COUNT - 1)]);
    message_write(MESSAGE_ROW + 1, "");
    hud_refresh_trolled();
  }
  if (++state_timer >= TROLLED_FRAMES && gone) restart_level();
}

/** "LEVEL CLEAR!"... then the punchline, and the hidden tokens pop in one by one. */
static void update_fake_clear(void) {
  ++state_timer;
  if (state_timer == FAKE_CLEAR_PUNCHLINE_FRAMES) {
    message_write(MESSAGE_ROW, "JUST KIDDING!");
    message_write(MESSAGE_ROW + 1, "PERDONAME NI~ITA");
    sfx_play(SFX_TROLLED);
    return;
  }
  if (state_timer < FAKE_CLEAR_REVEAL_FRAMES || (state_timer & REVEAL_INTERVAL_MASK)) return;
  if (tokens_hidden_left()) {
    tokens_reveal_one();
    return;
  }
  encore_played = 1;
  message_expire(MESSAGE_FRAMES);
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

static void update_died(void) {
  if (--state_timer == 0) enter_level();
}

/** Start continues from the same level with a fresh score and lives. */
static void update_game_over(void) {
  ++state_timer;
  if (state_timer == GAME_OVER_PROMPT_FRAMES) text_queue_centered(MESSAGE_ROW + 1, "PRESS START");
  if (state_timer > GAME_OVER_PROMPT_FRAMES && (pad_pressed & PAD_START)) {
    sfx_play(SFX_START);
    score_reset();
    enter_level();
  }
}

static void draw_world(void) {
  u8 reverse = frame_counter & 1;

  // Claude is drawn first so it never flickers; enemies and tokens alternate order
  // every frame so the 8-sprites-per-line limit spreads the flicker between them
  if (state == STATE_HURT || state == STATE_TROLLED) player_draw_hurt();
  else if (state != STATE_GAME_OVER && state != STATE_DIED) player_draw();
  if (is_boss_level()) {
    shots_draw();
    if (reverse) boss_draw();
  }
  platforms_draw(reverse);
  bugs_draw(reverse);
  if (is_boss_level() && !reverse) boss_draw();
  traps_draw();
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
          times_trolled = 0;
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
      case STATE_DIED:
        update_died();
        break;
      case STATE_TROLLED:
        update_trolled();
        break;
      case STATE_FAKE_CLEAR:
        update_fake_clear();
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
