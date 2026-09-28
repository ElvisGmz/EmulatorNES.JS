import { beforeAll, describe, expect, it } from "vitest";
import { buildRom } from "../build.mjs";
import { Buttons, createPlaytest, parseSymbols } from "../tools/playtest.mjs";

const BUG_PALETTE = 1;
const PLATFORM_PALETTE = 3;
const TOKEN_TILE = 0x60;
const LEVEL_TRANSITION_FRAMES = 160 + 110;
const KING_BUG_LEVEL = 5;
const SEGFAULT_LEVEL = 11;
const BOSS_LEVELS = [KING_BUG_LEVEL, SEGFAULT_LEVEL];
const BOSS_PALETTES = { [KING_BUG_LEVEL]: BUG_PALETTE, [SEGFAULT_LEVEL]: PLATFORM_PALETTE };
const BOSS_DEFEAT_FRAMES = 130;

let build;

beforeAll(async () => {
  build = await buildRom();
}, 60_000);

async function startGame() {
  const game = await createPlaytest(build.rom);
  const symbols = parseSymbols(build.labels);
  const memory = game.nes.cpu.mem;
  const read16 = (address) => memory[address] | (memory[address + 1] << 8);
  const write16 = (address, value) => {
    memory[address] = value & 0xff;
    memory[address + 1] = (value >> 8) & 0xff;
  };

  // Tokens are 16x16 background stars: find their top-left tiles in the nametable
  const tokenCells = () => {
    const tiles = game.nes.ppu.nameTable[0].tile;
    const cells = [];
    for (let index = 0; index < 32 * 30; index++) {
      if (tiles[index] === TOKEN_TILE) cells.push({ x: (index % 32) * 8, y: Math.floor(index / 32) * 8 });
    }
    return cells;
  };

  const place = (x, y, velocityY = 0) => {
    write16(symbols._player_x, x << 4);
    write16(symbols._player_y, y << 4);
    memory[symbols._player_velocity_y] = velocityY;
  };

  /** The boss's top-left corner, read back from its sprites (the King's crown uses another palette). */
  const bossPosition = () => {
    const palette = BOSS_PALETTES[memory[symbols._current_level]];
    const parts = game.sprites().filter((sprite) => sprite.palette === palette);
    if (parts.length === 0) return null;
    return { x: Math.min(...parts.map((part) => part.x)), y: Math.min(...parts.map((part) => part.y)) };
  };

  /** Throws a star at the boss from its left side (Claude stays invincible while aiming). */
  const throwStarAtBoss = () => {
    memory[symbols._star_ammo] = 1;
    memory[symbols._player_invincible] = 60;
    const boss = bossPosition();
    if (!boss) return game.frame(2);
    place(Math.max(8, boss.x - 24), boss.y + 12);
    memory[symbols._player_facing_left] = 0;
    return game.press(Buttons.B, 1, 1);
  };

  const defeatBoss = () => {
    for (let attempt = 0; attempt < 200 && memory[symbols._boss_health] > 0; attempt++) {
      memory[symbols._boss_health] = 1;
      throwStarAtBoss();
    }
    game.frame(BOSS_DEFEAT_FRAMES);
  };

  const skipToLevel = (level) => {
    while (memory[symbols._current_level] < level) {
      memory[symbols._lives] = 9;
      if (BOSS_LEVELS.includes(memory[symbols._current_level])) {
        defeatBoss();
      } else {
        memory[symbols._tokens_left] = 0;
      }
      game.frame(LEVEL_TRANSITION_FRAMES);
    }
  };

  return {
    game,
    tokenCells,
    skipToLevel,
    bossPosition,
    throwStarAtBoss,
    defeatBoss,
    symbols,
    memory,
    makeVulnerable: () => {
      memory[symbols._player_invincible] = 0;
    },
    state: () => ({
      level: memory[symbols._current_level],
      tokensLeft: memory[symbols._tokens_left],
      lives: memory[symbols._lives],
      score: read16(symbols._score) * 10,
      x: read16(symbols._player_x) >> 4,
      y: ((read16(symbols._player_y) << 16) >> 16) >> 4,
      onGround: memory[symbols._player_on_ground] === 1,
      ridingPlatform: memory[symbols._player_platform] !== 0xff,
      bossHealth: memory[symbols._boss_health],
      ammo: memory[symbols._star_ammo],
    }),
    place,
  };
}

describe("Claude Quest ROM", () => {
  it("is a valid NROM cartridge", () => {
    expect([...build.rom.slice(0, 4)]).toEqual([0x4e, 0x45, 0x53, 0x1a]);
    expect(build.rom.length).toBe(16 + 32768 + 8192);
  });

  it("shows the title and starts level 1 with music", async () => {
    const { game, state } = await startGame();
    game.frame(30);
    expect(game.readTextRow(11)).toBe("TOKEN QUEST");
    expect(game.takeAudioLevel()).toBeGreaterThan(0.01);

    game.press(Buttons.START).frame(20);
    expect(game.readTextRow(4)).toBe("LEVEL 1");
    expect(game.readTextRow(5)).toBe("HELLO, WORLD");
    expect(state()).toMatchObject({ level: 0, lives: 3, tokensLeft: 7 });
  });

  it("lands on clouds from below and drops through them with Down, alone or with A", async () => {
    const { game, state, place } = await startGame();
    game.frame(30).press(Buttons.START).frame(115);

    place(40, 192);
    game.frame(10);
    expect(state()).toMatchObject({ y: 192, onGround: true });

    game.down(Buttons.A).frame(14).up(Buttons.A).frame(40);
    expect(state()).toMatchObject({ y: 160, onGround: true });

    game.down(Buttons.DOWN).press(Buttons.A, 3, 1).up(Buttons.DOWN).frame(40);
    expect(state()).toMatchObject({ y: 192, onGround: true });

    game.down(Buttons.A).frame(14).up(Buttons.A).frame(40);
    expect(state()).toMatchObject({ y: 160, onGround: true });
    game.press(Buttons.DOWN, 3, 40);
    expect(state()).toMatchObject({ y: 192, onGround: true });
  });

  it("keeps Claude on solid ground when Down is pressed", async () => {
    const { game, state, place } = await startGame();
    game.frame(30).press(Buttons.START).frame(115);

    place(40, 192);
    game.frame(10).press(Buttons.DOWN, 3, 20);
    expect(state()).toMatchObject({ y: 192, onGround: true });
  });

  it("scores stomps and tokens, and clears the level", async () => {
    const { game, state, place, tokenCells } = await startGame();
    game.frame(30).press(Buttons.START).frame(115);

    const bug = game.sprites().find((sprite) => sprite.palette === BUG_PALETTE);
    const tokensBeforeStomp = state().tokensLeft;
    place(bug.x, bug.y - 30, 40);
    game.frame(12);
    // The bounce may also grab a nearby token, so account for it
    const tokensGrabbed = tokensBeforeStomp - state().tokensLeft;
    expect(state()).toMatchObject({ score: 100 + tokensGrabbed * 50, lives: 3 });

    expect(tokenCells()).toHaveLength(state().tokensLeft);
    for (let attempt = 0; attempt < 20 && state().tokensLeft > 0; attempt++) {
      const [token] = tokenCells();
      place(token.x, token.y);
      game.frame(3);
    }
    expect(tokenCells()).toHaveLength(0);
    game.frame(5);
    expect(game.readTextRow(4)).toBe("LEVEL CLEAR!");
    expect(state().score).toBe(100 + 7 * 50);
  });

  it("costs a life when falling into a pit", async () => {
    const { game, state, place, skipToLevel } = await startGame();
    game.frame(30).press(Buttons.START).frame(115);
    skipToLevel(1);
    const livesBefore = state().lives;

    place(98, 150);
    game.frame(120);
    expect(state().lives).toBe(livesBefore - 1);
  });

  it("bounces Claude high on springs, higher when A is held", async () => {
    const { game, state, place, skipToLevel, memory, symbols } = await startGame();
    game.frame(30).press(Buttons.START).frame(115);
    skipToLevel(6);

    const apexAfterDropOnSpring = () => {
      // The level's fly crosses the spring's path, so keep Claude safe while measuring
      memory[symbols._player_invincible] = 100;
      place(32, 150, 30);
      let apex = 255;
      for (let frame = 0; frame < 70; frame++) {
        game.frame(1);
        apex = Math.min(apex, state().y);
      }
      return apex;
    };

    const tappedApex = apexAfterDropOnSpring();
    game.down(Buttons.A);
    const heldApex = apexAfterDropOnSpring();
    game.up(Buttons.A);

    // The spring top is at y=192: a plain bounce rises ~60px, a held one clears the cloud at y=128
    expect(176 - tappedApex).toBeGreaterThanOrEqual(55);
    expect(heldApex + 16).toBeLessThanOrEqual(128);
  });

  it("hurts Claude on ice spikes", async () => {
    const { game, state, place, skipToLevel, makeVulnerable } = await startGame();
    game.frame(30).press(Buttons.START).frame(115);
    skipToLevel(6);
    makeVulnerable();
    const livesBefore = state().lives;

    place(68, 170, 20);
    game.frame(150);
    expect(state().lives).toBe(livesBefore - 1);
  });

  it("carries Claude on moving clouds", async () => {
    const { game, state, place, skipToLevel } = await startGame();
    game.frame(30).press(Buttons.START).frame(115);
    skipToLevel(7);
    game.frame(20);

    const platformSprites = game.sprites().filter((sprite) => sprite.palette === PLATFORM_PALETTE);
    expect(platformSprites).toHaveLength(8);
    const lowest = platformSprites.reduce((low, sprite) => (sprite.y > low.y ? sprite : low));

    place(lowest.x + 4, lowest.y - 24, 10);
    game.frame(14);
    const boarded = state();
    expect(boarded).toMatchObject({ onGround: true, ridingPlatform: true });

    game.frame(40);
    expect(Math.abs(state().x - boarded.x)).toBeGreaterThanOrEqual(20);
    expect(state().ridingPlatform).toBe(true);
  });

  it("fights the King Bug with thrown stars that grow back", async () => {
    const { game, state, place, skipToLevel, throwStarAtBoss, tokenCells, memory, symbols } = await startGame();
    game.frame(30).press(Buttons.START).frame(115);
    skipToLevel(KING_BUG_LEVEL - 1);
    memory[symbols._tokens_left] = 0;
    game.frame(170);
    expect(game.readTextRow(4)).toBe("BOSS FIGHT");
    expect(game.readTextRow(5)).toBe("KING BUG");
    expect(game.readTextRow(3)).toBe("KING BUG");
    game.frame(100);
    expect(state()).toMatchObject({ bossHealth: 12, ammo: 0 });

    const tokensAtStart = tokenCells().length;
    const [token] = tokenCells();
    // The King walks toward Claude meanwhile, so keep it safe
    memory[symbols._player_invincible] = 255;
    place(token.x, token.y);
    game.frame(3);
    expect(state().ammo).toBe(1);
    expect(state().tokensLeft).toBeGreaterThan(0);
    expect(tokenCells()).toHaveLength(tokensAtStart - 1);
    place(token.x + 48, token.y);
    game.frame(240);
    expect(tokenCells()).toHaveLength(tokensAtStart);

    throwStarAtBoss().frame(10);
    expect(state()).toMatchObject({ bossHealth: 11, ammo: 0 });
  });

  it("brings the boss back to full health after YOU DIED", async () => {
    const { game, state, place, skipToLevel, bossPosition, makeVulnerable, memory, symbols } = await startGame();
    game.frame(30).press(Buttons.START).frame(115);
    skipToLevel(KING_BUG_LEVEL);
    memory[symbols._boss_health] = 3;
    const livesBefore = state().lives;

    makeVulnerable();
    const boss = bossPosition();
    place(boss.x + 8, boss.y + 8);
    game.frame(90);
    expect(game.readTextRow(4)).toBe("YOU DIED");
    expect(state().lives).toBe(livesBefore - 1);

    game.frame(160);
    expect(game.readTextRow(4)).toBe("BOSS FIGHT");
    expect(state()).toMatchObject({ level: KING_BUG_LEVEL, bossHealth: 12 });
  });

  it("moves on to the next level once the King Bug falls", async () => {
    const { game, state, skipToLevel, defeatBoss } = await startGame();
    game.frame(30).press(Buttons.START).frame(115);
    skipToLevel(KING_BUG_LEVEL);
    const scoreBefore = state().score;

    defeatBoss();
    expect(game.readTextRow(4)).toBe("GREAT ENEMY FELLED");
    expect(state().score).toBeGreaterThanOrEqual(scoreBefore + 1000);
    game.frame(160);
    expect(game.readTextRow(4)).toBe("LEVEL 6");
    expect(state().level).toBe(6);
  });

  it("reaches the ending after beating the Segfault", async () => {
    const { game, skipToLevel, defeatBoss, memory, symbols } = await startGame();
    game.frame(30).press(Buttons.START).frame(115);
    skipToLevel(9);
    memory[symbols._tokens_left] = 0;
    // Level clear jingle, then the level 10 intro message
    game.frame(170);
    expect(game.readTextRow(2)).toMatch(/LEVEL 10$/);
    expect(game.readTextRow(4)).toBe("LEVEL 10");
    expect(game.readTextRow(5)).toBe("THE LAST TOKEN");
    game.frame(100);

    memory[symbols._tokens_left] = 0;
    game.frame(170);
    expect(game.readTextRow(4)).toBe("BOSS FIGHT");
    expect(game.readTextRow(5)).toBe("THE SEGFAULT");
    game.frame(100);

    defeatBoss();
    game.frame(LEVEL_TRANSITION_FRAMES);
    expect(game.readTextRow(6)).toBe("YOU DID IT!");
  });
});
