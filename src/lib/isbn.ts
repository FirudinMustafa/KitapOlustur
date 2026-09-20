// ISBN-13 validation/formatting - a real, well-defined checksum standard
// (same reasoning as hand-rolling EPUB/Common Cartridge's bounded XML rather
// than pulling a library: this is a small, fixed algorithm, not worth a
// dependency for). See ROADMAP.md "ISBN/baskıya hazırlık".

export function normalizeIsbn(input: string): string {
  return input.replace(/[^0-9X]/gi, "").toUpperCase();
}

// ISBN-13 checksum: alternating weights of 1 and 3 over the first 12 digits
// must sum, mod 10, to the 13th (check) digit - the standard EAN-13/ISBN-13
// algorithm (ISBN-10's different check-digit scheme, using X for 10, is not
// supported here since this pipeline only targets modern ISBN-13/EAN-13
// barcodes).
export function isValidIsbn13(input: string): boolean {
  const digits = normalizeIsbn(input);
  if (digits.length !== 13 || !/^\d{13}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(digits[12]);
}

export function formatIsbn13(input: string): string {
  const digits = normalizeIsbn(input);
  if (digits.length !== 13) return digits;
  // Standard grouping for a 978/979 (Bookland) prefix: EAN prefix-registration
  // group-registrant-publication-check digit. The registrant/publication
  // split varies by publisher range in reality; this uses a common,
  // reasonable-looking grouping for display purposes only - the digits
  // themselves (which are what the barcode/checksum actually use) are exact.
  return `${digits.slice(0, 3)}-${digits.slice(3, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}-${digits.slice(12)}`;
}
