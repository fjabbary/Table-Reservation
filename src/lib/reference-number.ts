// Human-friendly reservation reference, e.g. "RES-7K3M9P".
// Excludes visually ambiguous characters (0/O, 1/I) since guests may need to
// read this off a screen or receipt.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const LENGTH = 6;

export function generateReferenceNumber(): string {
  let code = "";
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `RES-${code}`;
}
