import path from "node:path";
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import * as fontkit from "fontkit";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { ANDIKA, BALOO, NOTO_SANS, NOTO_SERIF, NUNITO, registerBookFonts } from "./fonts";
import { rasterizePdf } from "./rasterize";

const FONTS_DIR = path.join(process.cwd(), "public", "fonts");
const TURKISH = "ıİşŞğĞçÇöÖüÜâÂîÎûÛ";

describe("book fonts", () => {
  it("every font file covers Turkish", () => {
    // NotoSansSymbols2 only backs up ✓/✗ (withSymbols) - it sets no text.
    for (const file of readdirSync(FONTS_DIR).filter((f) => f.endsWith(".ttf") && !f.startsWith("NotoSansSymbols2"))) {
      const font = fontkit.openSync(path.join(FONTS_DIR, file));
      const missing = [...TURKISH].filter((c) => !font.hasGlyphForCodePoint(c.codePointAt(0)!));
      expect(missing, file).toEqual([]);
    }
  });

  it("the symbol fallback has the tick and cross marks", () => {
    const font = fontkit.openSync(path.join(FONTS_DIR, "NotoSansSymbols2-Regular.ttf"));
    for (const c of "✓✔✗✘") expect(font.hasGlyphForCodePoint(c.codePointAt(0)!), c).toBe(true);
  });

  // The variable Noto files used to print bold in the regular weight - no
  // heading in any book was ever bold. Measured as ink on the rendered page.
  it("bold prints heavier than regular in every family", async () => {
    registerBookFonts();
    const families = [NOTO_SANS, NOTO_SERIF, BALOO, ANDIKA, NUNITO];
    const buf = await renderToBuffer(
      <Document>
        {families.flatMap((family) =>
          [400, 700].map((weight) => (
            <Page key={family + weight} size={{ width: 300, height: 60 }} style={{ padding: 10 }}>
              <Text style={{ fontFamily: family, fontWeight: weight, fontSize: 20 }}>Işık Şule 1234</Text>
            </Page>
          )),
        )}
      </Document>,
    );
    const pages = await rasterizePdf(new Uint8Array(buf), { dpi: 72 });
    const ink = await Promise.all(
      pages.map(async (p) => {
        const { data } = await sharp(p.png).greyscale().raw().toBuffer({ resolveWithObject: true });
        let dark = 0;
        for (const v of data) if (v < 128) dark++;
        return dark;
      }),
    );
    families.forEach((family, i) => expect(ink[i * 2 + 1], family).toBeGreaterThan(ink[i * 2] * 1.15));
  }, 60_000);
});
