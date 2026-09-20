// Hand-rolled PNG/JPEG pixel-dimension reader - no library, since both
// formats' headers are small, fixed, well-documented byte layouts (same
// "bounded spec, don't pull a dependency" reasoning used for EPUB/Common
// Cartridge/EAN-13 elsewhere in this codebase). Used by the print-readiness
// check (src/lib/print-readiness.ts) to see the ACTUAL pixel size of a
// generated cover image, not an assumption about what the image provider
// produced for a given aspectRatio string.

function readPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  // IHDR is always the first chunk: 8 (signature) + 4 (length) + 4 ("IHDR")
  // + 4 (width) + 4 (height), big-endian.
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function readJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null; // SOI marker

  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) return null; // malformed
    const marker = buffer[offset + 1];
    // SOF0-SOF15 markers (except the DHT/JPG/DAC markers in that byte range)
    // carry the frame's dimensions; every other marker's payload is just
    // skipped over using its own length field.
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (isSof) {
      if (offset + 9 > buffer.length) return null;
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

export function getImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  return readPngDimensions(buffer) ?? readJpegDimensions(buffer);
}
