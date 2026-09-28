# Claude: Token Quest

An original NES platformer starring Claude, written in C and 6502 assembly and built with
[cc65](https://cc65.github.io/) running as WebAssembly, so it needs nothing but Node.

Collect every star token in the level while stomping (or dodging) the bugs. Fifteen levels: seven gentle ones and eight
hard ones with springs, ice spikes, flying bugs and moving clouds, each half with its own music.

Each half ends with a souls-style boss fight with its own theme:

- **King Bug** charges (twice when enraged), leaps at you and sends shockwaves along the ground. Its shell deflects
  stars thrown at its face: hit it from behind, mid-leap, or while it is stunned against a wall.
- **The Segfault** fires aimed bursts of orbs, teleports, and dives on you, shaking the ground when it lands.

At half health both get enraged: faster, with extra attacks and, for the King, minions. In boss arenas the tokens are
star ammo (up to 3) that grows back 7 seconds after you grab it: throw stars with B. Every attack is telegraphed by a
flash, and a stunned boss can be stomped for double damage. Fall and you get "YOU DIED": the boss comes back at full
health. On game over, Start continues from the same level.

| Button | Action |
| --- | --- |
| D-pad | Move |
| A | Jump (hold for a higher jump, also on springs) |
| B | Run; in boss fights, throw a star (Up + B throws upward, Up + a direction diagonally) |
| Down (or Down + A) | Drop through a cloud or a moving cloud |
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
│   ├── level.c       # the 15 levels and 2 boss arenas, drawing and collision map
│   ├── player.c      # physics: acceleration, variable jump, coyote time, jump buffer
│   ├── bugs.c        # walking and flying enemies
│   ├── platforms.c   # moving clouds that carry Claude (and troll clouds that dodge)
│   ├── traps.c       # troll traps: crumbling ground, hidden spikes, falling icicles
│   ├── tokens.c      # collectible stars (background tiles), star ammo in boss arenas
│   ├── boss.c        # King Bug and The Segfault: state machines, projectiles, damage
│   ├── shots.c       # stars thrown by Claude
│   ├── hud.c         # score, lives, ammo, boss health bar and text
│   ├── screens.c     # title and ending screens
│   └── main.c        # game state machine
├── tools/            # cc65 runner, CHR encoder, music compiler, jsnes playtest harness
└── tests/            # Vitest tests, including a ROM that is played headlessly in jsnes
```

`assets.c/h` and `audio_data.c/h` are generated at build time from `art/` and `music/`, so art and music are
edited as plain text.

### Editing levels

Levels live in `src/level.c` as 13 rows of 16 characters:

| Symbol | Meaning |
| --- | --- |
| `.` | Sky |
| `#` | Ground |
| `=` | Cloud (one-way platform) |
| `P` | Player start |
| `X` | Boss (its bottom-right cell; arenas only) |
| `o` | Star token |
| `b` / `d` | Bug walking left / right |
| `f` | Flying bug |
| `S` | Spring |
| `^` | Ice spikes |
| `H` / `V` | Horizontal / vertical moving cloud (32 px wide) |
| `:` | Where moving clouds turn around (invisible) |

A tapped jump reaches 2 rows up, a held jump about 3.5 rows and a spring about 5. Keep tokens off columns 0 and 15:
the emulator crops 8 pixels on each side.

### Troll levels

Levels 3, 6, 10, 12 and 14 are troll levels: they are numbered, named and scored like the others and look the same,
but hide pieces that only show up when Claude gets close. Every trap has a short warning (cracks, a shaking icicle)
and stays put on a retry, so it can be learned. Dying there costs no life: a taunt shows under the HUD ("PERDONAME
NIÑITA", "Y NO TENES EL MAX!?", ...), a `TROLLED` counter goes up (it is also shown on the ending screen) and the
level starts over. Mark a level as a troll level in `level_trolls` in `src/level.c`.

| Symbol | Meaning |
| --- | --- |
| `%` | Ground that cracks when Claude is over it and falls away (with the ground below and every `%` next to it) |
| `!` | Ice spikes that pop up when Claude is about to walk or land on them |
| `Y` | Icicle hidden under a cloud; it shakes, then drops, when Claude walks near underneath |
| `h` | Horizontal moving cloud that darts away from Claude's first jump near it, then moves normally |
| `O` | Token that runs away to `1`, then `2` and `3`, when Claude gets close |
| `?` | Token hidden until a fake "LEVEL CLEAR!" (after it has played once, a retry shows it from the start) |

Messages are written in the game's font, where `~` draws an Ñ ("NI~ITA").

### Editing music

Each song in `music/songs.mjs` has up to four channels (`pulse1`, `pulse2`, `triangle`, `noise`). Notes are written
as `C5/8` (eighth), `G5/4.` (dotted quarter) or `r/4` (rest); drums are `K`, `S` and `H`. The build checks that the
channels of looping songs have the same length.
