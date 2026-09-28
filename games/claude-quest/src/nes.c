#include "nes.h"

#define JOYPAD1 (*(volatile u8 *)0x4016)
#define PALETTE_SIZE 32
#define VRAM_QUEUE_END 0xFF
#define VRAM_QUEUE_CAPACITY 95
#define HIDDEN_SPRITE_Y 0xF0

u8 pad_held;
u8 pad_pressed;

static u8 vram_queue_length;
static u8 oam_index;
static u8 index;

void ppu_wait_nmi(void) {
  u8 frame = frame_counter;
  nmi_ready = 1;
  while (frame == frame_counter) {
  }
  vram_queue_length = 0;
}

void ppu_off(void) {
  ppu_mask = 0;
  ppu_wait_nmi();
}

void ppu_on(void) {
  ppu_mask = MASK_RENDER_ALL;
  ppu_wait_nmi();
}

void vram_address(u16 address) {
  (void)PPU_STATUS;
  PPU_ADDR = (u8)(address >> 8);
  PPU_ADDR = (u8)address;
}

void vram_fill(u8 value, u16 length) {
  while (length--) PPU_DATA = value;
}

void vram_write(const u8 *data, u8 length) {
  for (index = 0; index < length; ++index) PPU_DATA = data[index];
}

void palette_set(const u8 *palette) {
  for (index = 0; index < PALETTE_SIZE; ++index) palette_buffer[index] = palette[index];
  palette_dirty = 1;
}

void vram_queue_reset(void) {
  vram_queue_length = 0;
  vram_queue[0] = VRAM_QUEUE_END;
}

void vram_queue_bytes(u16 address, const u8 *data, u8 length) {
  if (vram_queue_length + length + 3 > VRAM_QUEUE_CAPACITY) return;

  vram_queue[vram_queue_length++] = (u8)(address >> 8);
  vram_queue[vram_queue_length++] = (u8)address;
  vram_queue[vram_queue_length++] = length;
  for (index = 0; index < length; ++index) vram_queue[vram_queue_length++] = data[index];
  vram_queue[vram_queue_length] = VRAM_QUEUE_END;
}

void oam_begin(void) {
  oam_index = 0;
}

void oam_sprite(u8 x, u8 y, u8 tile, u8 attributes) {
  // Sprites are drawn one scanline below their OAM Y
  oam[oam_index] = y - 1;
  oam[oam_index + 1] = tile;
  oam[oam_index + 2] = attributes;
  oam[oam_index + 3] = x;
  oam_index += 4;
}

void oam_meta_2x2(u8 x, u8 y, u8 first_tile, u8 attributes) {
  if (attributes & SPRITE_FLIP_X) {
    oam_sprite(x, y, first_tile + 1, attributes);
    oam_sprite(x + 8, y, first_tile, attributes);
    oam_sprite(x, y + 8, first_tile + 17, attributes);
    oam_sprite(x + 8, y + 8, first_tile + 16, attributes);
    return;
  }
  oam_sprite(x, y, first_tile, attributes);
  oam_sprite(x + 8, y, first_tile + 1, attributes);
  oam_sprite(x, y + 8, first_tile + 16, attributes);
  oam_sprite(x + 8, y + 8, first_tile + 17, attributes);
}

void oam_end(void) {
  index = oam_index;
  do {
    oam[index] = HIDDEN_SPRITE_Y;
    index += 4;
  } while (index != 0);
}

u8 pad_poll(void) {
  u8 previous = pad_held;
  u8 state = 0;

  JOYPAD1 = 1;
  JOYPAD1 = 0;
  for (index = 0; index < 8; ++index) state = (state << 1) | (JOYPAD1 & 1);

  pad_held = state;
  pad_pressed = state & ~previous;
  return state;
}
