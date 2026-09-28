import { beforeAll, describe, expect, it } from "vitest";
import { buildRom } from "../build.mjs";
import { Buttons, createPlaytest, parseSymbols } from "../tools/playtest.mjs";

const BUG_PALETTE = 1;
const PLATFORM_PALETTE = 3;
const TOKEN_TILE = 0x60;
const LEVEL_TRANSITION_FRAMES = 160 + 110;
const KING_BUG_LEVEL = 7;
const SEGFAULT_LEVEL = 16;
const BOUNCE_HOUSE_LEVEL = 8;
const SKY_TRAIN_LEVEL = 9;
// Troll levels
const SOLID_GROUND_LEVEL = 2;
const SAFE_MODE_LEVEL = 5;
const SKY_TRAIN_2_LEVEL = 10;
const STABLE_RELEASE_LEVEL = 12;
const ALMOST_DONE_LEVEL = 14;
const SPIKES_TILE = 0x64;
const ICICLE_TILE = 0x80;
const TROLLED_FRAMES = 90;
// Clear jingle, punchline, then the hidden tokens popping in every 8 frames
const FAKE_CLEAR_FRAMES = 240;
// Most tests play through several levels first, which takes a few seconds in jsnes
const PLAYTHROUGH_TIMEOUT = 20_000;
const BOSS_LEVELS = [KING_BUG_LEVEL, SEGFAULT_LEVEL];
const BOSS_PALETTES = { [KING_BUG_LEVEL]: BUG_PALETTE, [SEGFAULT_LEVEL]: PLATFORM_PALETTE };
const BOSS_DEFEAT_FRAMES = 130;
const BOSS_WALKING = 1;
const BOSS_STUNNED = 5;
const TOKEN_REGROW_FRAMES = 420;

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

  const stunBoss = () => {
    memory[symbols._boss_state] = BOSS_STUNNED;
  };

  const defeatBoss = () => {
    for (let attempt = 0; attempt < 200 && memory[symbols._boss_health] > 0; attempt++) {
      memory[symbols._boss_health] = 1;
      stunBoss();
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

  /** Grabs every token on screen, one by one (Claude stays invincible meanwhile). */
  const grabAllTokens = () => {
    for (let attempt = 0; attempt < 20 && memory[symbols._tokens_left] > 0; attempt++) {
      memory[symbols._player_invincible] = 60;
      const [token] = tokenCells();
      if (!token) break;
      place(token.x, token.y);
      game.frame(3);
    }
  };

  /** Left edge of the lowest moving cloud, read back from its sprites. */
  const lowestCloudX = () => {
    const parts = game.sprites().filter((sprite) => sprite.palette === PLATFORM_PALETTE && sprite.tile !== ICICLE_TILE);
    const lowest = Math.max(...parts.map((part) => part.y));
    return Math.min(...parts.filter((part) => part.y === lowest).map((part) => part.x));
  };

  return {
    game,
    tokenCells,
    grabAllTokens,
    lowestCloudX,
    skipToLevel,
    bossPosition,
    throwStarAtBoss,
    stunBoss,
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
      trolled: memory[symbols._times_trolled],
    }),
    place,
  };
}

describe("Claude Quest ROM", { timeout: PLAYTHROUGH_TIMEOUT }, () => {
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
    skipToLevel(BOUNCE_HOUSE_LEVEL);

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
    skipToLevel(BOUNCE_HOUSE_LEVEL);
    makeVulnerable();
    const livesBefore = state().lives;

    place(68, 170, 20);
    game.frame(150);
    expect(state().lives).toBe(livesBefore - 1);
  });

  it("carries Claude on moving clouds", async () => {
    const { game, state, place, skipToLevel } = await startGame();
    game.frame(30).press(Buttons.START).frame(115);
    skipToLevel(SKY_TRAIN_LEVEL);
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
    const { game, state, place, skipToLevel, throwStarAtBoss, stunBoss, tokenCells, memory, symbols } =
      await startGame();
    game.frame(30).press(Buttons.START).frame(115);
    skipToLevel(KING_BUG_LEVEL - 1);
    memory[symbols._tokens_left] = 0;
    game.frame(170);
    expect(game.readTextRow(4)).toBe("BOSS FIGHT");
    expect(game.readTextRow(5)).toBe("KING BUG");
    expect(game.readTextRow(3)).toBe("KING BUG");
    game.frame(100);
    expect(state()).toMatchObject({ bossHealth: 24, ammo: 0 });

    const tokensAtStart = tokenCells().length;
    const [token] = tokenCells();
    // The King attacks Claude meanwhile, so keep it safe
    memory[symbols._player_invincible] = 255;
    place(token.x, token.y);
    game.frame(3);
    expect(state().ammo).toBe(1);
    expect(state().tokensLeft).toBeGreaterThan(0);
    expect(tokenCells()).toHaveLength(tokensAtStart - 1);
    place(token.x + 48, token.y);
    for (let waited = 0; waited < TOKEN_REGROW_FRAMES; waited += 60) {
      memory[symbols._player_invincible] = 255;
      game.frame(60);
    }
    expect(tokenCells()).toHaveLength(tokensAtStart);

    // While walking the King faces Claude, and its shell deflects stars thrown at its face
    memory[symbols._boss_state] = BOSS_WALKING;
    throwStarAtBoss().frame(10);
    expect(state()).toMatchObject({ bossHealth: 24, ammo: 0 });

    stunBoss();
    throwStarAtBoss().frame(10);
    expect(state()).toMatchObject({ bossHealth: 23, ammo: 0 });
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
    expect(state()).toMatchObject({ level: KING_BUG_LEVEL, bossHealth: 24 });
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
    expect(game.readTextRow(4)).toBe("LEVEL 8");
    expect(state().level).toBe(BOUNCE_HOUSE_LEVEL);
  });

  it("reaches the ending after beating the Segfault", async () => {
    const { game, skipToLevel, defeatBoss, grabAllTokens, memory, symbols } = await startGame();
    game.frame(30).press(Buttons.START).frame(115);
    skipToLevel(ALMOST_DONE_LEVEL);
    // Level 14 fakes its clear, so its hidden tokens have to be grabbed too
    memory[symbols._tokens_left] = 0;
    game.frame(FAKE_CLEAR_FRAMES);
    grabAllTokens();
    // Level clear jingle, then the level 15 intro message
    game.frame(170);
    expect(game.readTextRow(2)).toMatch(/LEVEL 15$/);
    expect(game.readTextRow(4)).toBe("LEVEL 15");
    expect(game.readTextRow(5)).toBe("THE LAST TOKEN");
    game.frame(100);

    memory[symbols._tokens_left] = 0;
    game.frame(170);
    expect(game.readTextRow(4)).toBe("BOSS FIGHT");
    expect(game.readTextRow(5)).toBe("THE SEGFAULT");
    game.frame(100);

    memory[symbols._times_trolled] = 3;
    defeatBoss();
    game.frame(LEVEL_TRANSITION_FRAMES);
    expect(game.readTextRow(6)).toBe("YOU DID IT!");
    expect(game.readTextRow(13)).toBe("TROLLED 3 TIMES");
  });
});

describe("Claude Quest troll levels", { timeout: PLAYTHROUGH_TIMEOUT }, () => {
  /** Starts a game and plays up to a troll level, past its intro. */
  async function startTrollLevel(level) {
    const session = await startGame();
    session.game.frame(30).press(Buttons.START).frame(115);
    session.skipToLevel(level);
    return session;
  }

  const nametableTile = (game, x, y) => game.nes.ppu.nameTable[0].tile[(y >> 3) * 32 + (x >> 3)];

  it("look like any other level: numbered in order, with an ordinary name", async () => {
    const { game, state, skipToLevel, memory, symbols } = await startGame();
    game.frame(30).press(Buttons.START).frame(115);
    skipToLevel(SOLID_GROUND_LEVEL - 1);
    memory[symbols._tokens_left] = 0;
    game.frame(170);
    expect(state().level).toBe(SOLID_GROUND_LEVEL);
    expect(game.readTextRow(4)).toBe("LEVEL 3");
    expect(game.readTextRow(5)).toBe("SOLID GROUND");
    expect(game.readTextRow(3)).toBe("");
  });

  it("open a pit under Claude, then start over without costing a life", async () => {
    const { game, state, place } = await startTrollLevel(SOLID_GROUND_LEVEL);
    const livesBefore = state().lives;
    place(16, 192);
    game.frame(2);
    expect(nametableTile(game, 48, 208)).not.toBe(0);

    game.hold(Buttons.RIGHT, 60).frame(10);
    expect(state()).toMatchObject({ trolled: 1, lives: livesBefore });
    expect(game.readTextRow(4)).toBe("PERDONAME NIÑITA");
    expect(game.readTextRow(3)).toBe("TROLLED 1");

    game.frame(TROLLED_FRAMES);
    // The level starts over, pit closed and every token back
    expect(state()).toMatchObject({ level: SOLID_GROUND_LEVEL, x: 16, y: 192, tokensLeft: 8, lives: livesBefore });
    expect(nametableTile(game, 48, 208)).not.toBe(0);
    expect(game.readTextRow(3)).toBe("TROLLED 1");
  });

  it("pop hidden spikes out of flat ground just ahead of Claude", async () => {
    const { game, state, place } = await startTrollLevel(SAFE_MODE_LEVEL);
    const spikesShown = () => nametableTile(game, 96, 192) === SPIKES_TILE;
    place(16, 192);
    game.frame(2);
    expect(spikesShown()).toBe(false);

    game.down(Buttons.RIGHT);
    for (let frame = 0; frame < 80 && !spikesShown(); frame++) game.frame(1);
    // They show up before Claude reaches them...
    expect(spikesShown()).toBe(true);
    expect(state()).toMatchObject({ trolled: 0 });
    expect(state().x + 12).toBeLessThan(96);
    // ...but too late to stop at walking speed
    game.frame(20).up(Buttons.RIGHT);
    expect(state().trolled).toBe(1);
    expect(game.readTextRow(4)).toBe("PERDONAME NIÑITA");
  });

  it("send the runaway token to its spots before it can be caught", async () => {
    const { game, state, place, tokenCells } = await startTrollLevel(SAFE_MODE_LEVEL);
    const tokensBefore = state().tokensLeft;
    const at = (x, y) => tokenCells().some((cell) => cell.x === x && cell.y === y);
    expect(at(176, 64)).toBe(true);

    place(150, 64);
    game.frame(4);
    expect(game.readTextRow(4)).toBe("Y NO TENES EL MAX!?");
    expect(at(176, 64)).toBe(false);
    expect(at(64, 64)).toBe(true);

    place(88, 64);
    game.frame(4);
    expect(game.readTextRow(4)).toBe("NOPE!");
    expect(at(32, 192)).toBe(true);
    expect(state().tokensLeft).toBe(tokensBefore);

    // Its last spot is where it finally gets caught
    place(32, 192);
    game.frame(4);
    expect(state().tokensLeft).toBe(tokensBefore - 1);
    expect(at(32, 192)).toBe(false);
  });

  it("make a troll cloud dart away from Claude's first jump, then ride normally", async () => {
    const { game, state, place, lowestCloudX } = await startTrollLevel(SKY_TRAIN_2_LEVEL);
    const waitForCloudAtLeftEnd = () => {
      for (let frame = 0; frame < 600 && lowestCloudX() > 64; frame++) game.frame(1);
    };
    place(32, 192);
    waitForCloudAtLeftEnd();

    game.down(Buttons.RIGHT).down(Buttons.A).frame(20);
    expect(lowestCloudX()).toBeGreaterThan(64 + 40);
    game.frame(60).up(Buttons.RIGHT).up(Buttons.A);
    expect(state().trolled).toBe(1);

    // After the dash it is an ordinary cloud: hop to set it off, wait for it and board it
    game.frame(TROLLED_FRAMES);
    place(32, 192);
    waitForCloudAtLeftEnd();
    game.press(Buttons.A, 4, 30);
    waitForCloudAtLeftEnd();
    game.down(Buttons.RIGHT).down(Buttons.A);
    for (let frame = 0; frame < 40 && !state().ridingPlatform; frame++) game.frame(1);
    game.up(Buttons.RIGHT).up(Buttons.A).frame(30);
    expect(state()).toMatchObject({ ridingPlatform: true, trolled: 1 });
  });

  describe("hidden icicles", () => {
    const icicleShown = (game) => game.sprites().some((sprite) => sprite.tile === ICICLE_TILE);
    const walkUnderIcicle = async (stopWhenItShakes) => {
      const { game, state, place } = await startTrollLevel(STABLE_RELEASE_LEVEL);
      place(40, 192);
      game.frame(2);
      expect(icicleShown(game)).toBe(false);
      game.down(Buttons.RIGHT);
      for (let frame = 0; frame < 80 && !state().trolled; frame++) {
        game.frame(1);
        if (stopWhenItShakes && icicleShown(game)) game.up(Buttons.RIGHT);
      }
      game.up(Buttons.RIGHT);
      return state().trolled;
    };

    it("drop on Claude walking under them", async () => {
      expect(await walkUnderIcicle(false)).toBe(1);
    });

    it("miss Claude if Claude stops when one shakes", async () => {
      expect(await walkUnderIcicle(true)).toBe(0);
    });
  });

  it("fake the level clear, then show more tokens to collect", async () => {
    const { game, state, grabAllTokens } = await startTrollLevel(ALMOST_DONE_LEVEL);
    expect(state().tokensLeft).toBe(4);

    grabAllTokens();
    game.frame(5);
    expect(game.readTextRow(4)).toBe("LEVEL CLEAR!");
    game.frame(100);
    expect(game.readTextRow(4)).toBe("JUST KIDDING!");
    expect(game.readTextRow(5)).toBe("PERDONAME NIÑITA");
    game.frame(FAKE_CLEAR_FRAMES - 105);
    expect(state()).toMatchObject({ level: ALMOST_DONE_LEVEL, tokensLeft: 4 });

    grabAllTokens();
    game.frame(5);
    expect(game.readTextRow(4)).toBe("LEVEL CLEAR!");
    game.frame(170);
    expect(state().level).toBe(ALMOST_DONE_LEVEL + 1);
  });

  it("show every token on a retry once the fake clear has played", async () => {
    const { game, state, place, grabAllTokens, makeVulnerable } = await startTrollLevel(ALMOST_DONE_LEVEL);
    grabAllTokens();
    game.frame(FAKE_CLEAR_FRAMES);
    makeVulnerable();
    place(72, 240);
    game.frame(10 + TROLLED_FRAMES);
    expect(state()).toMatchObject({ level: ALMOST_DONE_LEVEL, tokensLeft: 8, trolled: 1 });
  });
});
