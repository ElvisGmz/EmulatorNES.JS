const PRG_BANK_SIZE = 16384;
const CHR_BANK_SIZE = 8192;
const HEADER_SIZE = 16;

export function createInesRom({ mapper = 0, size = HEADER_SIZE + PRG_BANK_SIZE + CHR_BANK_SIZE } = {}): Uint8Array<ArrayBuffer> {
  const rom = new Uint8Array(size);
  rom.set([0x4e, 0x45, 0x53, 0x1a, 1, 1]);
  rom[6] = (mapper & 0x0f) << 4;
  rom[7] = mapper & 0xf0;
  return rom;
}
