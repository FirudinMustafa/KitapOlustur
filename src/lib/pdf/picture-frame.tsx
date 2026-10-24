import { Image, View } from "@react-pdf/renderer";
import type { Look } from "./blocks";
import { fitPicture, frameWidthFor, leavesGround, visiblePart, type FitOptions, type PictureRect } from "./picture-fit";

// A page picture drawn in its frame (picture-fit.ts). With the picture
// measured (look.pictures) it is placed by its real shape and object and
// the same rectangle goes to the frame's labels and speech bubbles; an
// unmeasured picture (a proof render) is drawn by react-pdf's object-fit
// as before, and its overlays assume the frame's generator shape.

export function pictureRect(look: Look, src: string, width: number, height: number, options: FitOptions): PictureRect | null {
  const info = look.pictures?.[src];
  return info && width > 0 && height > 0 ? fitPicture(width, height, info, options) : null;
}

// The fill behind a picture that does not reach its frame's edges: the
// picture's own plain ground, so the frame reads as one picture.
export function pictureGround(look: Look, src: string, rect: PictureRect | null, width: number, height: number): string | undefined {
  return rect && leavesGround(rect, width, height) ? look.pictures?.[src]?.ground : undefined;
}

// `width` and `height` are the frame's (pt), needed with a rect.
export function FramedImage({ src, rect, width = 0, height = 0, fit = "cover", anchorY = 0.5 }: { src: string; rect: PictureRect | null; width?: number; height?: number; fit?: "cover" | "contain"; anchorY?: number }) {
  if (rect) {
    const { box, positionX, positionY } = visiblePart(rect, width, height);
    const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
    return (
      <View style={{ position: "absolute", left: box.left, top: box.top, width: box.width, height: box.height }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop */}
        <Image src={src} style={{ width: "100%", height: "100%", objectFit: "cover", objectPositionX: pct(positionX), objectPositionY: pct(positionY) }} />
      </View>
    );
  }
  return (
    // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop
    <Image src={src} style={{ width: "100%", height: "100%", objectFit: fit, ...(fit === "cover" ? { objectPositionY: `${Math.round(anchorY * 100)}%` } : {}) }} />
  );
}

// A picture in a frame of its own, sized in pt.
export function FramedPicture({ src, width, height, look, radius, anchorY = 0.3, marginBottom }: { src: string; width: number; height: number; look: Look; radius: number; anchorY?: number; marginBottom?: number }) {
  const rect = pictureRect(look, src, width, height, { anchorY });
  const ground = pictureGround(look, src, rect, width, height);
  return (
    <View style={{ width, height, borderRadius: radius, overflow: "hidden", ...(ground ? { backgroundColor: ground } : {}), ...(marginBottom ? { marginBottom } : {}) }} wrap={false}>
      <FramedImage src={src} rect={rect} width={width} height={height} anchorY={anchorY} />
    </View>
  );
}

// The page's picture in the room left under (or over) a page's exercises -
// a card grid's foot, a workbook sheet's head. That room runs the content's
// full width at whatever height is left (110 pt under a card grid: 4.8:1),
// and a picture cropped to such a strip lost its subject (KIYAS-14 p.6:
// the two children's heads cut off at 4.2:1); the frame is no wider than
// BAND_MAX_ASPECT (or what keeps most of the picture, frameWidthFor),
// centred. That still lets it run across most of the page as the source's
// own picture strip does (Super Minds p.3, 2.3:1).
const BAND_MAX_ASPECT = 3;
export function BandPicture({ src, height, maxWidth, look, radius, anchorY = 0.3, marginBottom }: { src: string; height: number; maxWidth: number; look: Look; radius: number; anchorY?: number; marginBottom?: number }) {
  const width = frameWidthFor(look.pictures?.[src], maxWidth, height, BAND_MAX_ASPECT);
  return (
    <View style={{ alignItems: "center", ...(marginBottom ? { marginBottom } : {}) }} wrap={false}>
      <FramedPicture src={src} width={width} height={height} look={look} radius={radius} anchorY={anchorY} />
    </View>
  );
}
