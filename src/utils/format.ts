const BYTES_PER_KILOBYTE = 1024;

export function formatBytes(bytes: number): string {
  if (bytes < BYTES_PER_KILOBYTE) return `${bytes} B`;

  const kilobytes = bytes / BYTES_PER_KILOBYTE;
  if (kilobytes < BYTES_PER_KILOBYTE) return `${Math.round(kilobytes)} KB`;

  return `${(kilobytes / BYTES_PER_KILOBYTE).toFixed(1)} MB`;
}

/** "super_mario_bros (U) [!].nes" -> "super mario bros" */
export function titleFromFileName(fileName: string): string {
  const title = fileName
    .replace(/\.nes$/i, "")
    .replace(/[([][^)\]]*[)\]]/g, "")
    .replace(/[_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return title || "Juego sin nombre";
}
