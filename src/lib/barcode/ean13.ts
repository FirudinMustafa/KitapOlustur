// Hand-rolled EAN-13 barcode encoder - an ISBN-13 IS an EAN-13 barcode (the
// "Bookland" 978/979 prefix range), so this doubles as the ISBN barcode
// renderer for BookDocument.tsx. A well-defined, bounded, decades-old
// standard (fixed bit patterns below, from the EAN/UPC spec) - hand-rolled
// for the same reason EPUB/Common Cartridge were: no reason to pull a
// barcode-generation dependency for a fixed lookup-table algorithm this
// small. See ROADMAP.md "ISBN/baskıya hazırlık".
import { isValidIsbn13, normalizeIsbn } from "@/lib/isbn";

const L_CODE: Record<string, string> = {
  "0": "0001101",
  "1": "0011001",
  "2": "0010011",
  "3": "0111101",
  "4": "0100011",
  "5": "0110001",
  "6": "0101111",
  "7": "0111011",
  "8": "0110111",
  "9": "0001011",
};
const G_CODE: Record<string, string> = {
  "0": "0100111",
  "1": "0110011",
  "2": "0011011",
  "3": "0100001",
  "4": "0011101",
  "5": "0111001",
  "6": "0000101",
  "7": "0010001",
  "8": "0001001",
  "9": "0010111",
};
const R_CODE: Record<string, string> = {
  "0": "1110010",
  "1": "1100110",
  "2": "1101100",
  "3": "1000010",
  "4": "1011100",
  "5": "1001110",
  "6": "1010000",
  "7": "1000100",
  "8": "1001000",
  "9": "1110100",
};
// Which of L/G each of the 6 left-hand digits uses, keyed by the barcode's
// first (13th overall) digit - the standard EAN-13 parity table.
const PARITY: Record<string, string> = {
  "0": "LLLLLL",
  "1": "LLGLGG",
  "2": "LLGGLG",
  "3": "LLGGGL",
  "4": "LGLLGG",
  "5": "LGGLLG",
  "6": "LGGGLL",
  "7": "LGLGLG",
  "8": "LGLGGL",
  "9": "LGGLGL",
};

// Returns 95 modules (true = black bar, false = white space): 3 (start
// guard) + 42 (left 6 digits) + 5 (center guard) + 42 (right 6 digits) + 3
// (end guard). Returns null for anything that isn't a valid ISBN-13/EAN-13.
export function encodeEan13(isbn: string): boolean[] | null {
  if (!isValidIsbn13(isbn)) return null;
  const digits = normalizeIsbn(isbn);

  const firstDigit = digits[0];
  const leftDigits = digits.slice(1, 7);
  const rightDigits = digits.slice(7, 13);
  const parity = PARITY[firstDigit];

  let bits = "101"; // start guard
  for (let i = 0; i < 6; i++) {
    const code = parity[i] === "L" ? L_CODE : G_CODE;
    bits += code[leftDigits[i]];
  }
  bits += "01010"; // center guard
  for (let i = 0; i < 6; i++) {
    bits += R_CODE[rightDigits[i]];
  }
  bits += "101"; // end guard

  return bits.split("").map((b) => b === "1");
}
