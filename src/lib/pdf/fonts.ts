import path from "node:path";
import { Font } from "@react-pdf/renderer";

// "Site QA" (2026-09-23): the standard-14 PDF fonts (Times-Roman,
// Helvetica*) use WinAnsiEncoding, which has NO glyphs for Turkish ı/İ,
// ş/Ş, ğ/Ğ - the letters most distinctive to Turkish. Every PDF this app
// generates in Turkish rendered these as garbled/overlapping combining-mark
// glyphs (confirmed live: "Sayılarla Tanışıyorum" -> "Sayı̇arla Tanyoı̇rum"),
// which is almost certainly the dominant cause of the "characters look
// wrong" complaint - not just the separate Markdown-leak bug found earlier.
// Fixed by registering real Unicode fonts with full Turkish (Latin
// Extended-A) coverage instead. Noto Sans/Noto Serif's *variable* font
// files are used (not a per-weight static download) because Google Fonts'
// per-weight CDN delivery is subsetted by script (a "latin" file has ı but
// not ş/ğ; "latin-ext" has ş/ğ but not ı) - no single subsetted file covers
// Turkish. The variable font source files are NOT subsetted, so they carry
// every glyph in one file; @react-pdf/renderer's fontkit picks the right
// weight instance out of the variable font when multiple `fontWeight`
// entries point at the same file (documented react-pdf variable-font
// support), so one file per family/style still gives real regular+bold.
const FONTS_DIR = path.join(process.cwd(), "public", "fonts");

export const NOTO_SANS = "Noto Sans";
export const NOTO_SERIF = "Noto Serif";

let registered = false;

export function registerBookFonts() {
  if (registered) return;
  registered = true;

  Font.register({
    family: NOTO_SANS,
    fonts: [
      { src: path.join(FONTS_DIR, "NotoSans-Variable.ttf"), fontWeight: 400 },
      { src: path.join(FONTS_DIR, "NotoSans-Variable.ttf"), fontWeight: 700 },
      { src: path.join(FONTS_DIR, "NotoSans-Italic-Variable.ttf"), fontStyle: "italic", fontWeight: 400 },
    ],
  });

  Font.register({
    family: NOTO_SERIF,
    fonts: [
      { src: path.join(FONTS_DIR, "NotoSerif-Variable.ttf"), fontWeight: 400 },
      { src: path.join(FONTS_DIR, "NotoSerif-Variable.ttf"), fontWeight: 700 },
      { src: path.join(FONTS_DIR, "NotoSerif-Italic-Variable.ttf"), fontStyle: "italic", fontWeight: 400 },
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
  for (const family of [NOTO_SANS, NOTO_SERIF]) {
    for (const source of families[family]?.sources ?? []) {
      source.data = null;
      source.loadResultPromise = null;
    }
  }
}
