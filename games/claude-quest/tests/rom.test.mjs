import { beforeAll, describe, expect, it } from "vitest";
import { buildRom } from "../build.mjs";
import { Buttons, createPlaytest, parseSymbols } from "../tools/playtest.mjs";

const TOKEN_PALETTE = 2;
const BUG_PALETTE = 1;

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

  return {
    game,
    state: () => ({
      level: memory[symbols._current_level],
      tokensLeft: memory[symbols._tokens_left],
      lives: memory[symbols._lives],
      score: read16(symbols._score) * 10,
      x: read16(symbols._player_x) >> 4,
      y: ((read16(symbols._player_y) << 16) >> 16) >> 4,
      onGround: memory[symbols._player_on_ground] === 1,
    }),
    place: (x, y, velocityY = 0) => {
      write16(symbols._player_x, x << 4);
      write16(symbols._player_y, y << 4);
      memory[symbols._player_velocity_y] = velocityY;
    },
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

  it("lands on clouds from below and drops through them with Down + A", async () => {
    const { game, state, place } = await startGame();
    game.frame(30).press(Buttons.START).frame(115);

    place(40, 192);
    game.frame(10);
    expect(state()).toMatchObject({ y: 192, onGround: true });

    game.down(Buttons.A).frame(14).up(Buttons.A).frame(40);
    expect(state()).toMatchObject({ y: 160, onGround: true });

    game.down(Buttons.DOWN).press(Buttons.A, 3, 1).up(Buttons.DOWN).frame(40);
    expect(state()).toMatchObject({ y: 192, onGround: true });
  });

  it("scores stomps and tokens, and clears the level", async () => {
    const { game, state, place } = await startGame();
    game.frame(30).press(Buttons.START).frame(115);

    const bug = game.sprites().find((sprite) => sprite.palette === BUG_PALETTE);
    const tokensBeforeStomp = state().tokensLeft;
    place(bug.x, bug.y - 30, 40);
    game.frame(12);
    // The bounce may also grab a nearby token, so account for it
    const tokensGrabbed = tokensBeforeStomp - state().tokensLeft;
    expect(state()).toMatchObject({ score: 100 + tokensGrabbed * 50, lives: 3 });

    for (let attempt = 0; attempt < 20 && state().tokensLeft > 0; attempt++) {
      const token = game.sprites().find((sprite) => sprite.palette === TOKEN_PALETTE);
      place(token.x - 4, token.y - 6);
      game.frame(3);
    }
    game.frame(5);
    expect(game.readTextRow(4)).toBe("LEVEL CLEAR!");
    expect(state().score).toBe(100 + 7 * 50);
  });

  it("costs a life when falling into a pit", async () => {
    const { game, state, place } = await startGame();
    game.frame(30).press(Buttons.START).frame(115);
    game.nes.cpu.mem[parseSymbols(build.labels)._tokens_left] = 0;
    game.frame(160 + 110);
    expect(state().level).toBe(1);

    place(98, 150);
    game.frame(120);
    expect(state().lives).toBe(2);
  });
});
