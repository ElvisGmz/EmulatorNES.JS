#ifndef AUDIO_H
#define AUDIO_H

#include "audio_data.h"

void audio_init(void);
void audio_update(void);
void music_play(unsigned char song);
void music_stop(void);
unsigned char music_is_playing(void);
void sfx_play(unsigned char effect);
void audio_set_paused(unsigned char is_paused);

#endif
