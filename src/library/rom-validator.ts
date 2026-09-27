const INES_MAGIC = [0x4e, 0x45, 0x53, 0x1a];
const INES_HEADER_SIZE = 16;
export const MAX_ROM_SIZE_BYTES = 4 * 1024 * 1024;

export type RomValidationResult = { valid: true; mapper: number } | { valid: false; reason: string };

export function validateRom(data: Uint8Array): RomValidationResult {
  if (data.length < INES_HEADER_SIZE || INES_MAGIC.some((byte, index) => data[index] !== byte)) {
    return { valid: false, reason: "No es una ROM de NES válida (formato iNES)." };
  }
  if (data.length > MAX_ROM_SIZE_BYTES) {
    return { valid: false, reason: "El archivo es demasiado grande para una ROM de NES." };
  }

  const mapper = (data[6]! >> 4) | (data[7]! & 0xf0);
  return { valid: true, mapper };
}

export function describeRomLoadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const unsupportedMapper = /Unsupported mapper: (\d+)/.exec(message);

  if (unsupportedMapper) {
    return `Este juego usa el mapper ${unsupportedMapper[1]}, que el emulador aún no soporta.`;
  }
  if (message.includes("Not a valid NES ROM")) {
    return "No es una ROM de NES válida (formato iNES).";
  }
  return "No se pudo cargar el juego.";
}
