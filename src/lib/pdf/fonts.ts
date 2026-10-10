import path from "node:path";
import { Font } from "@react-pdf/renderer";
import type { FontRole } from "@/lib/design/themes";

// "Site QA" (2026-09-23): the standard-14 PDF fonts (Times-Roman,
// Helvetica*) use WinAnsiEncoding, which has NO glyphs for Turkish ı/İ,
// ş/Ş, ğ/Ğ - the letters most distinctive to Turkish. Every PDF this app
// generates in Turkish rendered these as garbled/overlapping combining-mark
// glyphs (confirmed live: "Sayılarla Tanışıyorum" -> "Sayı̇arla Tanyoı̇rum"),
// which is almost certainly the dominant cause of the "characters look
// wrong" complaint - not just the separate Markdown-leak bug found earlier.
// Fixed by registering real Unicode fonts with full Turkish (Latin
// Extended-A) coverage instead.
//
// 2026-10-10: every family is now a set of STATIC per-weight files. The
// variable Noto files used before printed bold text in the regular weight -
// react-pdf ignores fontWeight on a variable font and always draws its
// default instance, so no heading in any book had ever been bold (checked
// by rendering 400 vs 700 side by side). The static files are Google
// Fonts' full, unsubsetted per-weight TTFs (the css2 API serves those to a
// client without a browser user agent); each was checked glyph by glyph for
// ı/İ, ş/Ş, ğ/Ğ, ç, ö, ü and â/î/û before being added. Licences:
// public/fonts/OFL-*.txt.
const FONTS_DIR = path.join(process.cwd(), "public", "fonts");

export const NOTO_SANS = "Noto Sans";
export const NOTO_SERIF = "Noto Serif";
export const BALOO = "Baloo 2";
export const ANDIKA = "Andika";
export const NUNITO = "Nunito";

const ROLE_FAMILY: Record<FontRole, string> = {
  sans: NOTO_SANS,
  serif: NOTO_SERIF,
  rounded: BALOO,
  reading: ANDIKA,
  friendly: NUNITO,
};

export function pdfFontFamily(role: FontRole): string {
  return ROLE_FAMILY[role] ?? NOTO_SANS;
}

let registered = false;

export function registerBookFonts() {
  if (registered) return;
  registered = true;

  Font.register({
    family: NOTO_SANS,
    fonts: [
      { src: path.join(FONTS_DIR, "NotoSans-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONTS_DIR, "NotoSans-Bold.ttf"), fontWeight: 700 },
      { src: path.join(FONTS_DIR, "NotoSans-Italic.ttf"), fontStyle: "italic", fontWeight: 400 },
    ],
  });

  Font.register({
    family: NOTO_SERIF,
    fonts: [
      { src: path.join(FONTS_DIR, "NotoSerif-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONTS_DIR, "NotoSerif-Bold.ttf"), fontWeight: 700 },
      { src: path.join(FONTS_DIR, "NotoSerif-Italic.ttf"), fontStyle: "italic", fontWeight: 400 },
    ],
  });

  // Theme typefaces (see FontRole in src/lib/design/themes.ts). Static
  // per-weight files on purpose: react-pdf ignores fontWeight on a
  // variable font (it prints the default instance - Nunito came out
  // ExtraLight, Baloo never bold). Italic falls back to the upright face -
  // none of these themes sets body text in italic.
  Font.register({
    family: BALOO,
    fonts: [
      { src: path.join(FONTS_DIR, "Baloo2-Medium.ttf"), fontWeight: 400 },
      { src: path.join(FONTS_DIR, "Baloo2-Bold.ttf"), fontWeight: 700 },
      { src: path.join(FONTS_DIR, "Baloo2-Medium.ttf"), fontStyle: "italic", fontWeight: 400 },
    ],
  });
  Font.register({
    family: ANDIKA,
    fonts: [
      { src: path.join(FONTS_DIR, "Andika-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONTS_DIR, "Andika-Bold.ttf"), fontWeight: 700 },
      { src: path.join(FONTS_DIR, "Andika-Regular.ttf"), fontStyle: "italic", fontWeight: 400 },
    ],
  });
  Font.register({
    family: NUNITO,
    fonts: [
      { src: path.join(FONTS_DIR, "Nunito-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONTS_DIR, "Nunito-Bold.ttf"), fontWeight: 700 },
      { src: path.join(FONTS_DIR, "Nunito-Regular.ttf"), fontStyle: "italic", fontWeight: 400 },
    ],
  });

  // react-pdf hyphenates justified text by default using an English-only
  // dictionary - for Turkish content this silently mangles words at line
  // breaks. Disable hyphenation everywhere (return the word unchanged).
  Font.registerHyphenationCallback((word) => [word]);
}

// QA fix (2026-10-06): fontkit font objects are cached on the registered
// font sources and shared by every renderToBuffer call in the process. After
// the first document, later documents rendered in the same process (e.g.
// student_book then workbook in one assembly step, or any warm Fluid Compute
// instance) silently lost glyphs from the bold variable-font instance -
// digits vanished from headings ("2 - İki" printed as "- İki", "1-10" as
// "1-1"). Font.reset() does not help (it nulls `data` but keeps the memoized
// load promise, so nothing reloads) and Font.clear() also drops react-pdf's
// built-in Helvetica registration, so only this app's own font sources are
// reset - forcing a fresh fontkit object on the next load.
type ResettableFontSource = { data: unknown; loadResultPromise: unknown };

export function resetBookFonts() {
  registerBookFonts();
  const families = Font.getRegisteredFonts() as Record<string, { sources: ResettableFontSource[] }>;
  for (const family of [NOTO_SANS, NOTO_SERIF, BALOO, ANDIKA, NUNITO]) {
    for (const source of families[family]?.sources ?? []) {
      source.data = null;
      source.loadResultPromise = null;
    }
  }
}
