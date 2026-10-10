import { describe, expect, it } from "vitest";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { forEachRasterizedPage } from "./rasterize";

describe("forEachRasterizedPage", () => {
  it("hands over every page as a JPEG, one at a time", async () => {
    const pdf = await renderToBuffer(
      <Document>
        {[1, 2, 3].map((n) => (
          <Page key={n} size="A4">
            <Text>Page {n}</Text>
          </Page>
        ))}
      </Document>,
    );
    const seen: number[] = [];
    const total = await forEachRasterizedPage(new Uint8Array(pdf), async ({ pageNumber, jpeg }) => {
      expect([jpeg[0], jpeg[1]]).toEqual([0xff, 0xd8]); // JPEG SOI marker
      seen.push(pageNumber);
    }, { dpi: 30 });
    expect(total).toBe(3);
    expect(seen).toEqual([1, 2, 3]);
  });
});
