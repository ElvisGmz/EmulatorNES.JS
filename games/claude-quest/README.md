# Claude: Token Quest

An original NES platformer starring Claude, written in C and 6502 assembly and built with
[cc65](https://cc65.github.io/) running as WebAssembly, so it needs nothing but Node.

Collect every token in the level while stomping (or dodging) the bugs. Five levels, music and sound effects.

| Button | Action |
| --- | --- |
| D-pad | Move |
| A | Jump (hold for a higher jump) |
| B | Run |
| Down + A | Drop through a cloud |
| Start | Start / pause |

## Build

```bash
pnpm rom:build          # writes public/roms/claude-quest/claude-quest.nes
pnpm rom:preview-art    # renders both pattern tables to games/claude-quest/art-preview.png
pnpm test               # includes the ROM smoke tests in tests/
```

## How it is organized

```
games/claude-quest/
├── build.mjs         # art + music generation, compile, assemble and link
├── art/              # pixel art as ASCII drawings; index.mjs assigns tile numbers and palettes
├── music/songs.mjs   # songs and sound effects in note notation ("E5/8 G5/4.")
├── src/              # the game
│   ├── crt0.s        # iNES header, reset and NMI (OAM DMA, palette and VRAM queue)
│   ├── nes.c/h       # PPU, sprites and controller helpers
│   ├── audio.c/h     # sound driver: 4 music channels + 2 sound effect channels
│   ├── level.c       # the 5 levels, drawing and collision map
│   ├── player.c      # physics: acceleration, variable jump, coyote time, jump buffer
│   ├── bugs.c        # enemies
│   ├── tokens.c      # collectibles
│   ├── hud.c         # score, lives and text
│   ├── screens.c     # title and ending screens
│   └── main.c        # game state machine
├── tools/            # cc65 runner, CHR encoder, music compiler, jsnes playtest harness
└── tests/            # Vitest tests, including a ROM that is played headlessly in jsnes
```

`assets.c/h` and `audio_data.c/h` are generated at build time from `art/` and `music/`, so art and music are
edited as plain text.

### Editing levels

Levels live in `src/level.c` as 13 rows of 16 characters: `.` sky, `#` ground, `=` cloud (one-way platform),
`P` player start, `o` token, `b`/`d` bug walking left/right. A jump reaches two rows up.

### Editing music

Each song in `music/songs.mjs` has up to four channels (`pulse1`, `pulse2`, `triangle`, `noise`). Notes are written
as `C5/8` (eighth), `G5/4.` (dotted quarter) or `r/4` (rest); drums are `K`, `S` and `H`. The build checks that the
channels of looping songs have the same length.
