; Startup code, NMI handler and iNES header for an NROM-256 cartridge.
; The NMI only touches the PPU when C sets nmi_ready (see ppu_wait_nmi), so the
; main loop decides when OAM, palette and queued VRAM writes are committed.

.export __STARTUP__ : absolute = 1
.export _ppu_ctrl, _ppu_mask, _scroll_x, _scroll_y
.export _palette_buffer, _palette_dirty, _vram_queue, _oam
.exportzp _frame_counter, _nmi_ready

.import _main, copydata, zerobss
.importzp c_sp

PPU_CTRL    = $2000
PPU_MASK    = $2001
PPU_STATUS  = $2002
OAM_ADDR    = $2003
PPU_SCROLL  = $2005
PPU_ADDR    = $2006
PPU_DATA    = $2007
OAM_DMA     = $4014
APU_STATUS  = $4015
APU_FRAME   = $4017

C_STACK_TOP = $0800
VRAM_QUEUE_END = $FF

.segment "HEADER"
    .byte "NES", $1A
    .byte 2             ; 2 x 16 KB PRG ROM
    .byte 1             ; 1 x 8 KB CHR ROM
    .byte %00000001     ; mapper 0, vertical mirroring
    .byte %00000000
    .res 8, 0

.segment "ZEROPAGE"
_frame_counter: .res 1
_nmi_ready:     .res 1

.segment "BSS"
_ppu_ctrl:       .res 1
_ppu_mask:       .res 1
_scroll_x:       .res 1
_scroll_y:       .res 1
_palette_dirty:  .res 1
_palette_buffer: .res 32
; Entries: address high, address low, length, bytes... terminated by $FF
_vram_queue:     .res 96

.segment "OAM"
_oam: .res 256

.segment "STARTUP"
reset:
    sei
    cld
    ldx #$40
    stx APU_FRAME           ; disable APU frame IRQ
    ldx #$FF
    txs
    inx
    stx PPU_CTRL
    stx PPU_MASK
    stx APU_STATUS

    bit PPU_STATUS
@wait_vblank_1:
    bit PPU_STATUS
    bpl @wait_vblank_1

    lda #0
    tax
@clear_ram:
    sta $0000, x
    sta $0100, x
    sta $0300, x
    sta $0400, x
    sta $0500, x
    sta $0600, x
    sta $0700, x
    inx
    bne @clear_ram

    lda #$F0                ; park every sprite below the screen
@hide_sprites:
    sta _oam, x
    inx
    bne @hide_sprites

@wait_vblank_2:
    bit PPU_STATUS
    bpl @wait_vblank_2

    lda #<C_STACK_TOP
    sta c_sp
    lda #>C_STACK_TOP
    sta c_sp+1

    jsr zerobss
    jsr copydata

    lda #VRAM_QUEUE_END
    sta _vram_queue
    lda #%10001000          ; enable NMI, background tiles at $0000, sprite tiles at $1000
    sta _ppu_ctrl
    sta PPU_CTRL

    jmp _main

nmi:
    pha
    txa
    pha
    tya
    pha

    lda _nmi_ready
    beq @done

    lda #0
    sta OAM_ADDR
    lda #>_oam
    sta OAM_DMA

    bit PPU_STATUS
    lda _palette_dirty
    beq @vram_queue
    lda #$3F
    sta PPU_ADDR
    lda #$00
    sta PPU_ADDR
    ldx #0
@palette_loop:
    lda _palette_buffer, x
    sta PPU_DATA
    inx
    cpx #32
    bne @palette_loop
    lda #0
    sta _palette_dirty

@vram_queue:
    ldx #0
@queue_entry:
    lda _vram_queue, x
    cmp #VRAM_QUEUE_END
    beq @queue_done
    sta PPU_ADDR
    inx
    lda _vram_queue, x
    sta PPU_ADDR
    inx
    ldy _vram_queue, x
    inx
@queue_bytes:
    lda _vram_queue, x
    sta PPU_DATA
    inx
    dey
    bne @queue_bytes
    jmp @queue_entry
@queue_done:
    lda #VRAM_QUEUE_END
    sta _vram_queue

    lda _scroll_x
    sta PPU_SCROLL
    lda _scroll_y
    sta PPU_SCROLL
    lda _ppu_ctrl
    sta PPU_CTRL
    lda _ppu_mask
    sta PPU_MASK

    lda #0
    sta _nmi_ready

@done:
    inc _frame_counter
    pla
    tay
    pla
    tax
    pla
irq:
    rti

.segment "VECTORS"
    .word nmi
    .word reset
    .word irq

.segment "CHARS"
    .incbin "chr.bin"
