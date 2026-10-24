// Free, deterministic artwork for the hand-made i5-style book
// (handcraft-i5-full.tsx): the generated pictures and card slices composed
// into the picture areas a publisher's designer would build - a family
// tree, a chalkboard of school subjects, a landmark collage, clocks, card
// grids. Nothing here calls a model; it is sharp + SVG only.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

export const IMG_DIR = path.join(process.cwd(), ".handmade", "img");
const COMP_DIR = path.join(process.cwd(), ".handmade", "comp");

export const img = (name: string) => fs.readFileSync(path.join(IMG_DIR, `${name}.png`));

const svg = (w: number, h: number, body: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);

type Layer = { input: Buffer; left: number; top: number };
async function canvas(w: number, h: number, layers: Layer[], bg = { r: 255, g: 255, b: 255, alpha: 0 }) {
  return sharp({ create: { width: w, height: h, channels: 4, background: bg } })
    .composite(layers.map((l) => ({ ...l, left: Math.round(l.left), top: Math.round(l.top) })))
    .png()
    .toBuffer();
}
const contain = (buf: Buffer, w: number, h: number) =>
  sharp(buf).resize(Math.round(w), Math.round(h), { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
// White card background knocked out, so a card sits on any colour.
async function knockout(buf: Buffer) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const m = Math.min(data[i], data[i + 1], data[i + 2]);
    if (m > 244) data[i + 3] = 0;
    else if (m > 232) data[i + 3] = Math.round(((244 - m) / 12) * 255);
  }
  return sharp(data, { raw: info }).png().toBuffer();
}
async function circle(buf: Buffer, d: number, ring = "#ffffff", ringW = 8) {
  const face = await sharp(buf).resize(d, d, { fit: "cover", position: "top" }).png().toBuffer();
  const masked = await sharp(face)
    .composite([{ input: svg(d, d, `<circle cx="${d / 2}" cy="${d / 2}" r="${d / 2 - 1}" fill="#fff"/>`), blend: "dest-in" }])
    .png()
    .toBuffer();
  return canvas(d, d, [{ input: masked, left: 0, top: 0 }, { input: svg(d, d, `<circle cx="${d / 2}" cy="${d / 2}" r="${d / 2 - ringW / 2}" fill="none" stroke="${ring}" stroke-width="${ringW}"/>`), left: 0, top: 0 }]);
}
async function rounded(buf: Buffer, w: number, h: number, r: number, fit: "cover" | "contain" = "cover", bg = "#ffffff") {
  const base = fit === "cover"
    ? await sharp(buf).resize(w, h, { fit: "cover" }).png().toBuffer()
    : await canvas(w, h, [{ input: await contain(buf, w * 0.86, h * 0.86), left: w * 0.07, top: h * 0.07 }], hexRgb(bg));
  return sharp(base).composite([{ input: svg(w, h, `<rect width="${w}" height="${h}" rx="${r}" fill="#fff"/>`), blend: "dest-in" }]).png().toBuffer();
}
function hexRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, alpha: 1 };
}

async function cached(name: string, make: () => Promise<Buffer>): Promise<Buffer> {
  fs.mkdirSync(COMP_DIR, { recursive: true });
  const file = path.join(COMP_DIR, `${name}.png`);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const buf = await make();
  fs.writeFileSync(file, buf);
  return buf;
}

// --- welcome module -----------------------------------------------------------

export const FAMILY = [
  { name: "Frank", card: 1, x: 430, y: 20 },
  { name: "Ruth", card: 2, x: 630, y: 20 },
  { name: "David", card: 3, x: 70, y: 255 },
  { name: "Rosa", card: 4, x: 260, y: 255 },
  { name: "Anna", card: 5, x: 790, y: 255 },
  { name: "Paul", card: 6, x: 980, y: 255 },
  { name: "Leo", card: 7, x: 40, y: 500 },
  { name: "Mia", card: 8, x: 240, y: 500 },
  { name: "Jack", card: 9, x: 800, y: 500 },
  { name: "Ella", card: 10, x: 1000, y: 500 },
];

export function familyTree() {
  return cached("family-tree", async () => {
    const W = 1200;
    const H = 760;
    const D = 150;
    const branch = "#E07A2E";
    const tree = svg(
      W,
      H,
      `<g stroke="${branch}" stroke-linecap="round" fill="none">
        <path d="M600 760 C 600 600, 590 420, 600 230" stroke-width="58"/>
        <path d="M600 330 C 520 300, 330 300, 245 330" stroke-width="30"/>
        <path d="M600 330 C 690 300, 880 300, 960 330" stroke-width="30"/>
        <path d="M245 340 C 200 420, 160 480, 120 560" stroke-width="20"/>
        <path d="M245 340 C 270 430, 300 500, 320 560" stroke-width="18"/>
        <path d="M960 340 C 920 430, 890 500, 880 560" stroke-width="18"/>
        <path d="M960 340 C 1010 430, 1050 500, 1080 560" stroke-width="20"/>
        <path d="M600 240 C 560 170, 540 130, 505 100" stroke-width="22"/>
        <path d="M600 240 C 640 170, 660 130, 705 100" stroke-width="22"/>
      </g>
      <g fill="#8BC34A" opacity="0.85">
        <circle cx="560" cy="250" r="18"/><circle cx="650" cy="210" r="14"/><circle cx="420" cy="300" r="12"/>
        <circle cx="790" cy="300" r="15"/><circle cx="170" cy="460" r="11"/><circle cx="1030" cy="450" r="13"/>
      </g>`,
    );
    const layers: Layer[] = [{ input: tree, left: 0, top: 0 }];
    for (const p of FAMILY) {
      layers.push({ input: await circle(img(`w-family-${p.card}`), D, "#ffffff", 9), left: p.x, top: p.y });
      const tagW = 120;
      layers.push({
        input: svg(tagW, 44, `<rect x="2" y="2" width="${tagW - 4}" height="40" rx="10" fill="#EC407A" stroke="#fff" stroke-width="3"/><text x="${tagW / 2}" y="31" font-family="Arial" font-weight="bold" font-size="26" fill="#fff" text-anchor="middle">${p.name}</text>`),
        left: p.x + (D - tagW) / 2,
        top: p.y + D - 14,
      });
    }
    return canvas(W, H, layers);
  });
}

export const SUBJECT_COUNT = 8;
export function chalkboard() {
  return cached("chalkboard", async () => {
    const W = 1500;
    const H = 640;
    const layers: Layer[] = [
      {
        input: svg(
          W,
          H,
          `<rect x="0" y="0" width="${W}" height="${H}" rx="26" fill="#9C6B3C"/><rect x="26" y="26" width="${W - 52}" height="${H - 52}" rx="12" fill="#2F6B46"/>
           <rect x="26" y="26" width="${W - 52}" height="${H - 52}" rx="12" fill="url(#g)" opacity="0.35"/>
           <defs><radialGradient id="g" cx="0.3" cy="0.2" r="0.9"><stop offset="0" stop-color="#fff" stop-opacity="0.5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
           <rect x="90" y="${H - 34}" width="160" height="14" rx="5" fill="#f4f4f4"/><rect x="290" y="${H - 34}" width="70" height="14" rx="5" fill="#FFD54F"/>`,
        ),
        left: 0,
        top: 0,
      },
    ];
    const cols = 4;
    const cellW = (W - 120) / cols;
    const cellH = (H - 100) / 2;
    for (let i = 0; i < SUBJECT_COUNT; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = 60 + c * cellW;
      const y = 50 + r * cellH;
      const obj = await knockout(img(`w-subjects-${i + 1}`));
      // chalk-white halo so dark objects read on the board
      layers.push({ input: svg(Math.round(cellW), 190, `<ellipse cx="${cellW / 2}" cy="95" rx="${cellW * 0.32}" ry="88" fill="#ffffff" opacity="0.92"/>`), left: x, top: y });
      layers.push({ input: await contain(obj, cellW * 0.6, 170), left: x + cellW * 0.2, top: y + 10 });
      const lw = 230;
      layers.push({
        input: svg(lw + 46, 50, `<circle cx="22" cy="25" r="20" fill="#E2001A"/><text x="22" y="34" font-family="Arial" font-weight="bold" font-size="24" fill="#fff" text-anchor="middle">${i + 1}</text><rect x="46" y="4" width="${lw}" height="42" rx="6" fill="#fff"/>${
          i === 0 ? `<text x="${46 + lw / 2}" y="35" font-family="Arial" font-weight="bold" font-size="26" fill="#1E88E5" text-anchor="middle">Geography</text>` : ""
        }`),
        left: x + (cellW - lw - 46) / 2,
        top: y + 196,
      });
    }
    return canvas(W, H, layers);
  });
}

export const LANDMARK_TILES = [
  { x: 40, y: 150, w: 420, h: 330, rot: -4 },
  { x: 500, y: 60, w: 470, h: 330, rot: 3 },
  { x: 1010, y: 140, w: 430, h: 330, rot: -2 },
  { x: 60, y: 560, w: 430, h: 320, rot: 3 },
  { x: 530, y: 520, w: 430, h: 330, rot: -3 },
  { x: 1000, y: 560, w: 440, h: 320, rot: 2 },
];
export function landmarkCollage() {
  return cached("landmarks", async () => {
    const W = 1480;
    const H = 960;
    const layers: Layer[] = [
      {
        input: svg(
          W,
          H,
          `<path d="M-20 520 C 300 300, 700 760, 1500 380 L 1500 600 C 800 960, 300 520, -20 760 Z" fill="#1565C0" opacity="0.9"/>
           <path d="M-20 560 C 300 360, 700 800, 1500 430" stroke="#fff" stroke-width="10" stroke-dasharray="30 26" fill="none" opacity="0.8"/>
           <path d="M-20 720 C 300 480, 700 900, 1500 560" stroke="#fff" stroke-width="10" stroke-dasharray="30 26" fill="none" opacity="0.8"/>`,
        ),
        left: 0,
        top: 0,
      },
    ];
    for (let i = 0; i < LANDMARK_TILES.length; i++) {
      const t = LANDMARK_TILES[i];
      const photo = await rounded(img(`w-landmarks-${i + 1}`), t.w - 20, t.h - 20, 10, "contain", ["#E3F2FD", "#FFF8E1", "#E8F5E9", "#FCE4EC", "#EDE7F6", "#FFF3E0"][i]);
      const framed = await canvas(t.w, t.h, [{ input: svg(t.w, t.h, `<rect width="${t.w}" height="${t.h}" rx="14" fill="#fff"/>`), left: 0, top: 0 }, { input: photo, left: 10, top: 10 }]);
      const rot = await sharp(framed).rotate(t.rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      layers.push({ input: rot, left: t.x, top: t.y });
    }
    return canvas(W, H, layers);
  });
}

function clockFace(kind: "analog" | "digital" | "watch", time: [number, number], colour: string) {
  const [h, m] = time;
  if (kind === "digital") {
    return `<rect x="10" y="40" width="200" height="120" rx="22" fill="${colour}"/><rect x="28" y="62" width="164" height="76" rx="10" fill="#E8F5E9"/>
      <text x="110" y="120" font-family="Courier New" font-weight="bold" font-size="52" fill="#263238" text-anchor="middle">${h}:${String(m).padStart(2, "0")}</text>`;
  }
  const r = kind === "watch" ? 70 : 88;
  const cx = 110;
  const cy = 100;
  const ma = (m / 60) * 2 * Math.PI;
  const ha = (((h % 12) + m / 60) / 12) * 2 * Math.PI;
  const hand = (a: number, len: number, wdt: number) =>
    `<line x1="${cx}" y1="${cy}" x2="${cx + Math.sin(a) * len}" y2="${cy - Math.cos(a) * len}" stroke="#263238" stroke-width="${wdt}" stroke-linecap="round"/>`;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * 2 * Math.PI;
    return `<line x1="${cx + Math.sin(a) * (r - 6)}" y1="${cy - Math.cos(a) * (r - 6)}" x2="${cx + Math.sin(a) * (r - 18)}" y2="${cy - Math.cos(a) * (r - 18)}" stroke="#455A64" stroke-width="${i % 3 ? 3 : 6}"/>`;
  }).join("");
  const strap = kind === "watch" ? `<rect x="${cx - 34}" y="0" width="68" height="200" rx="16" fill="${colour}"/>` : "";
  return `${strap}<circle cx="${cx}" cy="${cy}" r="${r + 12}" fill="${colour}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFDE7"/>${ticks}${hand(ha, r * 0.5, 9)}${hand(ma, r * 0.78, 6)}<circle cx="${cx}" cy="${cy}" r="8" fill="#E2001A"/>`;
}

export function clocks() {
  return cached("clocks", async () => {
    const rows: { kind: "analog" | "digital" | "watch"; times: [[number, number], [number, number]]; colours: [string, string]; tile: string }[] = [
      { kind: "analog", times: [[7, 15], [7, 45]], colours: ["#FB8C00", "#E53935"], tile: "#43A047" },
      { kind: "digital", times: [[8, 20], [2, 40]], colours: ["#00897B", "#8E24AA"], tile: "#1E88E5" },
      { kind: "watch", times: [[10, 5], [11, 50]], colours: ["#1E88E5", "#FDD835"], tile: "#E53935" },
    ];
    const W = 700;
    const H = 760;
    const body = rows
      .map((row, i) => {
        const y = i * 250;
        return `<g transform="translate(0 ${y})"><rect x="6" y="50" width="120" height="120" rx="22" fill="${row.tile}" transform="rotate(-6 66 110)"/>
          <text x="66" y="145" font-family="Arial Black, Arial" font-weight="bold" font-size="92" fill="#fff" text-anchor="middle">${i + 1}</text>
          <g transform="translate(150 0)">${clockFace(row.kind, row.times[0], row.colours[0])}<circle cx="200" cy="190" r="22" fill="#fff" stroke="#E2001A" stroke-width="4"/><text x="200" y="199" font-family="Arial" font-weight="bold" font-size="26" fill="#E2001A" text-anchor="middle">a</text></g>
          <g transform="translate(420 0)">${clockFace(row.kind, row.times[1], row.colours[1])}<circle cx="200" cy="190" r="22" fill="#fff" stroke="#E2001A" stroke-width="4"/><text x="200" y="199" font-family="Arial" font-weight="bold" font-size="26" fill="#E2001A" text-anchor="middle">b</text></g></g>`;
      })
      .join("");
    return sharp(svg(W, H, body)).png().toBuffer();
  });
}

// A grid of cards as ONE picture (a publisher's single artwork), with room
// under each card for a caption printed over it by the PDF.
export async function cardGrid(name: string, cards: Buffer[], cols: number, opts: { cell?: number; caption?: number; tiles?: string[]; gap?: number; radius?: number } = {}) {
  return cached(name, async () => {
    const cell = opts.cell ?? 300;
    const cap = opts.caption ?? 0;
    const gap = opts.gap ?? 24;
    const rows = Math.ceil(cards.length / cols);
    const W = cols * cell + (cols - 1) * gap;
    const H = rows * (cell + cap) + (rows - 1) * gap;
    const layers: Layer[] = [];
    for (let i = 0; i < cards.length; i++) {
      const x = (i % cols) * (cell + gap);
      const y = Math.floor(i / cols) * (cell + cap + gap);
      const tile = opts.tiles?.[i % opts.tiles.length];
      if (tile) layers.push({ input: svg(cell, cell, `<rect width="${cell}" height="${cell}" rx="${opts.radius ?? 22}" fill="${tile}"/>`), left: x, top: y });
      const art = tile ? await knockout(cards[i]) : cards[i];
      layers.push({ input: await contain(art, cell * 0.86, cell * 0.86), left: x + cell * 0.07, top: y + cell * 0.07 });
    }
    return canvas(W, H, layers, { r: 255, g: 255, b: 255, alpha: 0 });
  });
}

export async function stackedFaces(name: string, cards: string[], colours: string[]) {
  return cached(name, async () => {
    const D = 230;
    const H = cards.length * 270;
    const layers: Layer[] = [];
    for (let i = 0; i < cards.length; i++) {
      layers.push({ input: svg(300, 260, `<rect x="10" y="20" width="270" height="230" rx="30" fill="${colours[i]}" transform="rotate(${i % 2 ? 4 : -4} 150 135)"/>`), left: 0, top: i * 270 });
      layers.push({ input: await circle(img(cards[i]), D, "#fff", 10), left: 35, top: i * 270 + 20 });
    }
    return canvas(300, H, layers);
  });
}

export async function sticker(name: string, w: number, h: number, body: string) {
  return cached(name, async () => sharp(svg(w, h, body)).png().toBuffer());
}

export function didYouKnow() {
  return sticker(
    "did-you-know",
    560,
    240,
    `<g transform="rotate(-8 280 120)"><rect x="40" y="40" width="490" height="170" rx="18" fill="#9CCC65"/><rect x="52" y="52" width="466" height="146" rx="12" fill="#fff"/>
     <circle cx="110" cy="70" r="58" fill="#E2001A"/><text x="110" y="62" font-family="Arial Black, Arial" font-weight="bold" font-size="30" fill="#fff" text-anchor="middle">Did</text>
     <text x="110" y="96" font-family="Arial" font-weight="bold" font-size="22" fill="#FFEB3B" text-anchor="middle">you know?</text></g>`,
  );
}

export function nowICan() {
  return sticker(
    "now-i-can",
    620,
    150,
    `<path d="M10 30 L590 10 L610 120 L30 140 Z" fill="#E2001A"/><text x="300" y="98" font-family="Arial Black, Arial" font-weight="bold" font-size="64" fill="#fff" text-anchor="middle" transform="rotate(-2 300 80)">NOW I CAN</text>`,
  );
}

// Five faces on coloured bars - "I'm crazy about it" to "I can't stand it".
export async function likeScale(icons: Buffer[]) {
  return cached("like-scale", async () => {
    const W = 760;
    const rowH = 118;
    const colours = ["#EC407A", "#AB47BC", "#29B6F6", "#66BB6A", "#FFA726"];
    const layers: Layer[] = [];
    icons.forEach((_, i) => {
      const len = 640 - i * 90;
      layers.push({ input: svg(W, rowH, `<rect x="110" y="28" width="${len}" height="64" rx="32" fill="${colours[i]}"/><rect x="${110 + len - 260}" y="38" width="240" height="44" rx="10" fill="#fff" opacity="0.9"/>`), left: 0, top: i * rowH });
    });
    for (let i = 0; i < icons.length; i++) layers.push({ input: await contain(icons[i], 96, 96), left: 6, top: i * rowH + 10 });
    return canvas(W, icons.length * rowH, layers);
  });
}
