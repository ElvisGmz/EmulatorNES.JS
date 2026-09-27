import { describe, expect, it } from "vitest";
import { createInesRom } from "../test-utils/ines-rom";
import { describeRomLoadError, MAX_ROM_SIZE_BYTES, validateRom } from "./rom-validator";

describe("validateRom", () => {
  it("accepts an iNES ROM and reads its mapper", () => {
    expect(validateRom(createInesRom({ mapper: 4 }))).toEqual({ valid: true, mapper: 4 });
    expect(validateRom(createInesRom({ mapper: 66 }))).toEqual({ valid: true, mapper: 66 });
  });

  it("rejects files without the iNES signature", () => {
    expect(validateRom(new TextEncoder().encode("not a rom at all")).valid).toBe(false);
    expect(validateRom(new Uint8Array(4)).valid).toBe(false);
  });

  it("rejects oversized files", () => {
    expect(validateRom(createInesRom({ size: MAX_ROM_SIZE_BYTES + 1 })).valid).toBe(false);
  });
});

describe("describeRomLoadError", () => {
  it("explains unsupported mappers", () => {
    expect(describeRomLoadError(new Error("Unsupported mapper: 85"))).toContain("mapper 85");
  });

  it("falls back to a generic message", () => {
    expect(describeRomLoadError("boom")).toBe("No se pudo cargar el juego.");
  });
});
