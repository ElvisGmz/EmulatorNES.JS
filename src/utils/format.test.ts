import { describe, expect, it } from "vitest";
import { formatBytes, titleFromFileName } from "./format";
import { hashBytes } from "./hash";

describe("formatBytes", () => {
  it.each([
    [512, "512 B"],
    [40976, "40 KB"],
    [1024 * 1024 * 1.5, "1.5 MB"],
  ])("formats %d bytes as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe("titleFromFileName", () => {
  it("removes the extension, region tags and separators", () => {
    expect(titleFromFileName("Super_Mario_Bros_3 (U) (PRG1) [!].nes")).toBe("Super Mario Bros 3");
    expect(titleFromFileName("zelda.NES")).toBe("zelda");
  });

  it("falls back when nothing is left", () => {
    expect(titleFromFileName("(U).nes")).toBe("Juego sin nombre");
  });
});

describe("hashBytes", () => {
  it("is deterministic and content sensitive", () => {
    expect(hashBytes(new Uint8Array([1, 2, 3]))).toBe(hashBytes(new Uint8Array([1, 2, 3])));
    expect(hashBytes(new Uint8Array([1, 2, 3]))).not.toBe(hashBytes(new Uint8Array([3, 2, 1])));
    expect(hashBytes(new Uint8Array())).toHaveLength(8);
  });
});
