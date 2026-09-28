# NES Emulator.JS

NES emulator for the browser, built on top of [jsnes](https://github.com/bfirsh/jsnes). Works on desktop (keyboard or
gamepad) and on phones (on-screen touch controller, portrait and landscape).

## Getting started

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

| Script           | Description                              |
| ---------------- | ---------------------------------------- |
| `pnpm dev`       | Dev server with HMR                      |
| `pnpm build`     | Type-check and build into `dist/`        |
| `pnpm preview`   | Serve the production build               |
| `pnpm test`      | Unit tests (Vitest)                      |
| `pnpm typecheck` | TypeScript only                          |

> The app must be served over `http(s)`. Opening `index.html` from disk (`file://`) blocks ROM downloads and audio.

## Features

- Emulation paced by `requestAnimationFrame` at the NES native rate (60.0988 fps), independent from audio and from
  the display refresh rate (60/120/144 Hz).
- Low-latency audio through an `AudioWorklet`, unlocked on the first user gesture as browsers require.
- ROM library: built-in catalog plus your own `.nes` files (file picker or drag & drop), persisted in IndexedDB.
- Save/load state per game, pause, reset, mute and fullscreen.
- Input from keyboard, touch (multi-touch, sliding between buttons, 8-way D-pad) and standard gamepads.
- Soft haptic feedback on the touch controller: Vibration API on Android, native `switch` haptics on iOS 18+ (fires
  when a tap completes, since iOS exposes no vibration API). Can be turned off from the Controls dialog.
- Installable as an app (PWA). On iPhone, where Safari has no Fullscreen API, the fullscreen button explains how to add
  it to the home screen to play without browser bars.
- Auto-pause when the tab is hidden or the library/help is open.

## Adding games to the built-in catalog

1. Copy the ROM (and its license) into its own folder inside `public/roms/`.
2. Add an entry to `public/roms/catalog.json`:

```json
{ "id": "my-game", "title": "My Game", "file": "my-game/my-game.nes", "year": 2024, "genre": "Homebrew", "author": "Someone" }
```

3. Credit it in `public/roms/CREDITS.md`.

Only add ROMs you are allowed to distribute (e.g. freely licensed homebrew). Currently bundled: Claude: Token Quest
(original), and LJ65 and Concentration Room by Damian Yerrick (GPL). Players can always load their own ROMs from the UI; those never leave their browser.

## Claude: Token Quest

`games/claude-quest` holds an original NES platformer made for this project, written in C with cc65 (as WebAssembly,
no native tools). `pnpm rom:build` rebuilds `public/roms/claude-quest/claude-quest.nes`. See its
[README](games/claude-quest/README.md).

## Project structure

```
src/
├── app/         # Composition root: wires emulator, input, library and UI together
├── emulator/    # jsnes wrapper, frame loop, video renderer and audio output
├── input/       # Keyboard, touch and gamepad devices merged by InputHub
├── library/     # Built-in catalog, user ROMs and save states (IndexedDB)
├── ui/          # DOM views: library list, overlays, toasts, icons, fullscreen
├── utils/       # Small framework-agnostic helpers
└── test-utils/  # Test fixtures
```

## Deployment

Deployed on Vercel as a static Vite build (see `vercel.json`): `pnpm build` → `dist/`.
