// Where a picture is drawn inside its frame - the ONE place this is worked
// out, shared by the picture itself and by what points at it (the labels'
// arrows, the speech bubbles' tails), so the two can never disagree.
//
// 2026-10-24, "pictures shifted in their frames": the frame drew its
// picture with object-fit "cover" at a fixed vertical anchor while the
// overlays assumed the shape the picture was *meant* to have (the
// generator size for the slot); the picture actually stored can have
// another shape (an older run, a free-mode square, a slot re-measured
// since), and a picture of one object on a plain ground was cropped like a
// scene - the globe's map cut off at the foot, a row of objects cut at both
// ends. Measured pictures (picture-info.ts) are fitted here by their real
// shape and, for an object on a plain ground, by where the object is.

/** A box in fractions of a picture (0..1). */
export type FractionBox = { x0: number; y0: number; x1: number; y1: number };

export type PictureInfo = {
  /** width / height of the stored picture. */
  aspect: number;
  /** The object of a picture drawn on a plain ground; unset for a scene (colour to its edges). */
  subject?: FractionBox;
  /** That plain ground's colour (#rrggbb) - the frame's fill where the picture does not reach. */
  ground?: string;
};

/** The drawn picture in frame coordinates (pt): it may run past the frame (cropped) or sit inside it. */
export type PictureRect = { left: number; top: number; width: number; height: number };

export type FitOptions = {
  fit?: "cover" | "contain";
  /** Where a cropped scene is anchored, 0 = top (faces sit in a picture's upper part). */
  anchorY?: number;
  anchorX?: number;
};

// An object keeps this share of the frame clear on each side.
const SUBJECT_MARGIN = 0.05;

export function fitPicture(frameW: number, frameH: number, picture: Pick<PictureInfo, "aspect" | "subject">, { fit = "cover", anchorY = 0.5, anchorX = 0.5 }: FitOptions = {}): PictureRect {
  const { aspect, subject } = picture;
  const coverW = Math.max(frameW, frameH * aspect);
  const containW = Math.min(frameW, frameH * aspect);
  if (fit === "contain") {
    const width = containW;
    const height = width / aspect;
    return { left: (frameW - width) / 2, top: (frameH - height) / 2, width, height };
  }
  if (!subject) {
    // As react-pdf draws object-fit "cover" with an object position.
    const width = coverW;
    const height = width / aspect;
    return { left: (frameW - width) * anchorX, top: (frameH - height) * anchorY, width, height };
  }
  // An object on a plain ground: as large as the frame allows with all of
  // the object inside it (never smaller than contain, never past cover),
  // the object centred and the picture's ground filling the rest.
  const sw = Math.max(0.01, subject.x1 - subject.x0);
  const sh = Math.max(0.01, subject.y1 - subject.y0);
  const room = 1 - 2 * SUBJECT_MARGIN;
  const fitsW = Math.min((frameW * room) / sw, (frameH * room * aspect) / sh);
  const width = Math.max(containW, Math.min(coverW, fitsW));
  const height = width / aspect;
  const place = (frame: number, drawn: number, centre: number) => {
    const want = frame / 2 - centre * drawn;
    return Math.min(Math.max(want, Math.min(0, frame - drawn)), Math.max(0, frame - drawn));
  };
  return {
    left: place(frameW, width, (subject.x0 + subject.x1) / 2),
    top: place(frameH, height, (subject.y0 + subject.y1) / 2),
    width,
    height,
  };
}

// A scene in a frame much wider than itself keeps at least this share of
// its height: a square picture cropped to a 2.8:1 strip kept 36% of it,
// the children's faces cut at the mouth (KIYAS-13 p.4).
const MIN_SCENE_SHARE = 0.75;

// The width a frame of this height takes for a picture: a scene's frame is
// no wider than `maxAspect` or than what keeps MIN_SCENE_SHARE of the
// picture, whichever allows more; an object on a plain ground keeps the
// frame (fitPicture fills it with the ground). Unmeasured: `maxAspect`.
export function frameWidthFor(picture: Pick<PictureInfo, "aspect" | "subject"> | undefined, width: number, height: number, maxAspect: number): number {
  if (picture?.subject) return width;
  const widest = Math.max(maxAspect, picture ? picture.aspect / MIN_SCENE_SHARE : 0) * height;
  return Math.min(width, Math.round(widest));
}

/** Where a point of the picture (fractions) lands in the frame (pt). */
export function pointInFrame(rect: PictureRect, point: { x: number; y: number }): { px: number; py: number } {
  return { px: rect.left + point.x * rect.width, py: rect.top + point.y * rect.height };
}

// How react-pdf draws a fitted picture: an image larger than its frame
// cannot be placed as itself - a node taller than the page "can't wrap"
// and pushed a full-page scene onto plain flow (KIYAS-14 p.4). So the part
// of the picture inside the frame becomes a box of its own, and the
// picture fills that box with object-fit "cover" at the object position
// that puts it where `rect` says - the same pixels, nothing outside the
// frame. In each direction the picture either sits inside the frame (the
// box is the picture) or runs past both edges (the box is the frame), so
// "cover" on the box is exactly the picture's scale.
export function visiblePart(rect: PictureRect, frameW: number, frameH: number): { box: PictureRect; positionX: number; positionY: number } {
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const box = { left, top, width: Math.min(frameW, rect.left + rect.width) - left, height: Math.min(frameH, rect.top + rect.height) - top };
  const position = (start: number, drawn: number, size: number) => (drawn - size > 0.01 ? Math.min(1, Math.max(0, -start / (drawn - size))) : 0.5);
  return { box, positionX: position(rect.left - left, rect.width, box.width), positionY: position(rect.top - top, rect.height, box.height) };
}

/** True when the drawn picture leaves part of the frame bare. */
export function leavesGround(rect: PictureRect, frameW: number, frameH: number): boolean {
  return rect.left > 0.5 || rect.top > 0.5 || rect.left + rect.width < frameW - 0.5 || rect.top + rect.height < frameH - 0.5;
}
