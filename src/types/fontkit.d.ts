// Minimal types for fontkit (no published typings) - only what the font
// coverage test (src/lib/pdf/fonts.test.tsx) uses.
declare module "fontkit" {
  export interface Font {
    familyName: string;
    hasGlyphForCodePoint(codePoint: number): boolean;
  }
  export function openSync(path: string): Font;
}
