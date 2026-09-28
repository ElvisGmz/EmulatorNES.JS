#ifndef NES_H
#define NES_H

typedef unsigned char u8;
typedef signed char s8;
typedef unsigned int u16;
typedef signed int s16;

#define PPU_STATUS (*(volatile u8 *)0x2002)
#define PPU_ADDR (*(volatile u8 *)0x2006)
#define PPU_DATA (*(volatile u8 *)0x2007)

#define NAMETABLE_A 0x2000
#define NAMETABLE_ADDR(x, y) (NAMETABLE_A + ((u16)(y) << 5) + (x))
#define ATTRIBUTE_TABLE_A 0x23C0

#define PAD_A 0x80
#define PAD_B 0x40
#define PAD_SELECT 0x20
#define PAD_START 0x10
#define PAD_UP 0x08
#define PAD_DOWN 0x04
#define PAD_LEFT 0x02
#define PAD_RIGHT 0x01

#define SPRITE_FLIP_X 0x40
#define SPRITE_BEHIND 0x20

#define MASK_RENDER_ALL 0x1E

extern u8 frame_counter;
#pragma zpsym("frame_counter")
extern u8 nmi_ready;
#pragma zpsym("nmi_ready")

extern u8 ppu_ctrl;
extern u8 ppu_mask;
extern u8 scroll_x;
extern u8 scroll_y;
extern u8 palette_buffer[32];
extern u8 palette_dirty;
extern u8 vram_queue[96];
extern u8 oam[256];

void ppu_wait_nmi(void);
void ppu_off(void);
void ppu_on(void);

void vram_address(u16 address);
void vram_fill(u8 value, u16 length);
void vram_write(const u8 *data, u8 length);

void palette_set(const u8 *palette);

void vram_queue_reset(void);
void vram_queue_bytes(u16 address, const u8 *data, u8 length);
// Bytes still free in this frame's queue; each write costs its length plus 3
u8 vram_queue_space(void);

void oam_begin(void);
void oam_sprite(u8 x, u8 y, u8 tile, u8 attributes);
void oam_meta_2x2(u8 x, u8 y, u8 first_tile, u8 attributes);
void oam_meta_4x4(u8 x, u8 y, u8 first_tile, u8 attributes, u16 visible_tiles);
void oam_end(void);

u8 pad_poll(void);
extern u8 pad_held;
extern u8 pad_pressed;

#endif
