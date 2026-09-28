import { describe, expect, it } from "vitest";
import { buildAudioData } from "../music/index.mjs";
import { encodeTile, splitIntoTiles } from "../tools/chr.mjs";
import { buildPeriodTable, compileStream, noteNumber, streamLength } from "../tools/music.mjs";

describe("music compiler", () => {
  it("numbers notes from C1", () => {
    expect(noteNumber("C1")).toBe(0);
    expect(noteNumber("A4")).toBe(45);
    expect(noteNumber("F#3")).toBe(noteNumber("Gb3"));
    expect(() => noteNumber("H2")).toThrow();
  });

  it("tunes A4 to 440 Hz on the pulse channel", () => {
    const period = buildPeriodTable()[noteNumber("A4")];
    expect(1789773 / (16 * (period + 1))).toBeCloseTo(440, 0);
  });

  it("compiles note values into frame durations", () => {
    const bytes = compileStream("C5/8 r/4 E5/16.", { framesPerSixteenth: 6, instrument: 1 });
    expect(bytes).toEqual([0x71, 0x80 | 12, noteNumber("C5"), 0x80 | 24, 0x6c, 0x80 | 9, noteNumber("E5"), 0xff]);
    expect(streamLength(bytes)).toBe(12 + 24 + 9);
  });

  it("rejects durations that do not land on whole frames", () => {
    expect(() => compileStream("C5/16.", { framesPerSixteenth: 5 })).toThrow(/whole frame/);
  });

  it("keeps every channel of the looping songs in sync", () => {
    expect(() => buildAudioData()).not.toThrow();
  });
});

describe("CHR encoder", () => {
  it("encodes pixels into two bitplanes", () => {
    const rows = ["abc.....", ...Array(7).fill("........")];
    const bytes = encodeTile(rows, { ".": 0, a: 1, b: 2, c: 3 });
    expect(bytes[0]).toBe(0b10100000);
    expect(bytes[8]).toBe(0b01100000);
  });

  it("splits drawings into 8x8 tiles left to right, top to bottom", () => {
    const drawing = Array.from({ length: 16 }, (_, y) => (y < 8 ? "a".repeat(8) + ".".repeat(8) : ".".repeat(16)));
    const tiles = splitIntoTiles(drawing);
    expect(tiles).toHaveLength(4);
    expect(tiles[0][0]).toBe("aaaaaaaa");
    expect(tiles[1][0]).toBe("........");
  });
});
