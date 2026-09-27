const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Fast, non-cryptographic FNV-1a hash, enough to detect duplicated ROM files. */
export function hashBytes(data: Uint8Array): string {
  let hash = FNV_OFFSET_BASIS;
  for (const byte of data) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
