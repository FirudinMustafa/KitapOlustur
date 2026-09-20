import { describe, expect, it } from "vitest";
import { getImageDimensions } from "./image-dimensions";

function makeMinimalPng(width: number, height: number): Buffer {
  const buf = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8); // IHDR chunk length
  Buffer.from("IHDR").copy(buf, 12);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function makeMinimalJpeg(width: number, height: number): Buffer {
  // SOI + a dummy APP0 segment + SOF0 with width/height + trailing bytes.
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]); // length 4, 2 payload bytes
  const sof0 = Buffer.alloc(9);
  sof0.writeUInt8(0xff, 0);
  sof0.writeUInt8(0xc0, 1);
  sof0.writeUInt16BE(8, 2); // segment length (not counting the marker bytes)
  sof0.writeUInt8(8, 4); // precision
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof0]);
}

describe("getImageDimensions", () => {
  it("reads PNG dimensions from the IHDR chunk", () => {
    expect(getImageDimensions(makeMinimalPng(1024, 576))).toEqual({ width: 1024, height: 576 });
  });

  it("reads JPEG dimensions from the SOF0 segment", () => {
    expect(getImageDimensions(makeMinimalJpeg(1344, 768))).toEqual({ width: 1344, height: 768 });
  });

  it("returns null for an unrecognized format", () => {
    expect(getImageDimensions(Buffer.from("not an image"))).toBeNull();
  });

  it("returns null for a truncated buffer", () => {
    expect(getImageDimensions(Buffer.alloc(2))).toBeNull();
  });
});
