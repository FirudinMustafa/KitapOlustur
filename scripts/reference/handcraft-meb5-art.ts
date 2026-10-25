// Free, deterministic artwork for "Paper Kite 5" Unit 2 (handcraft-meb5.tsx):
// SVG drawn at the print resolution and rasterised with sharp, no model
// calls. Everything an exercise depends on is drawn here, so the picture
// and the item can never disagree: clocks show exactly the stated time,
// the class corner and Kerem's desk hold exactly the counted things
// (handcraft-meb5-content.ts CORNER / CUPBOARD), the board game squares are
// where the text is printed. Paid pictures (handcraft-meb5-images.mts)
// land in .handmade-meb5/img; until they exist, placeholder() stands in at
// the final size.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { DPI, knockOutside } from "./print-kit";
import { CORNER, CUPBOARD } from "./handcraft-meb5-content";

const ROOT = path.join(process.cwd(), ".handmade-meb5");
export const IMG_DIR = path.join(ROOT, "img");
const COMP_DIR = path.join(ROOT, `art-${DPI}`);
export const PX = DPI / 72; // px per pt

export const C = {
  teal: "#0E9AA7",
  tealDark: "#0B6E78",
  tealTint: "#E2F5F4",
  coral: "#FF6B4A",
  coralDark: "#D9482A",
  coralTint: "#FFE8E1",
  sun: "#FFC53D",
  sunTint: "#FFF5D6",
  navy: "#1D2B4F",
  lilac: "#7C5CC4",
  lilacTint: "#EFE9FB",
  leaf: "#4CAF50",
  leafTint: "#E7F5E5",
  sky: "#CDEBFA",
  paper: "#FFFDF7",
  grey: "#9AA3B5",
};

export const has = (name: string) => fs.existsSync(path.join(IMG_DIR, `${name}.png`));
export const img = (name: string) => fs.readFileSync(path.join(IMG_DIR, `${name}.png`));

export const svg = (w: number, h: number, body: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(h)}" viewBox="0 0 ${Math.round(w)} ${Math.round(h)}">${body}</svg>`);

export async function cached(name: string, make: () => Promise<Buffer>): Promise<Buffer> {
  fs.mkdirSync(COMP_DIR, { recursive: true });
  const file = path.join(COMP_DIR, `${name.replace(/[^\w.-]/g, "_")}.png`);
  if (fs.existsSync(file) && !process.env.REBUILD_ART) return fs.readFileSync(file);
  const buf = await make();
  fs.writeFileSync(file, buf);
  return buf;
}
/** An SVG drawing for a box of w x h pt, drawn in px at the print resolution. */
export function draw(name: string, wPt: number, hPt: number, body: (W: number, H: number) => string) {
  const W = Math.round(wPt * PX);
  const H = Math.round(hPt * PX);
  return cached(`${name}-${W}x${H}`, async () => sharp(svg(W, H, body(W, H))).png().toBuffer());
}
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// --- clocks ---------------------------------------------------------------------------------
/** One analogue clock centred in the box; hhmm "" draws a face without hands (draw-the-hands items). */
export function clockSvg(cx: number, cy: number, r: number, hhmm: string, rim: string = C.teal, opts: { numerals?: boolean; red?: boolean } = {}) {
  const numerals = opts.numerals ?? true;
  let hands = "";
  if (hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    const ma = (m / 60) * 2 * Math.PI;
    const ha = (((h % 12) + m / 60) / 12) * 2 * Math.PI;
    const hand = (a: number, len: number, wdt: number, c: string) =>
      `<line x1="${cx}" y1="${cy}" x2="${cx + Math.sin(a) * len}" y2="${cy - Math.cos(a) * len}" stroke="${c}" stroke-width="${wdt}" stroke-linecap="round"/>`;
    hands = hand(ha, r * 0.48, r * 0.1, C.navy) + hand(ma, r * 0.76, r * 0.065, opts.red ? C.coralDark : C.navy);
  }
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * 2 * Math.PI;
    const long = i % 5 === 0;
    const r0 = r * (long ? 0.86 : 0.91);
    return `<line x1="${cx + Math.sin(a) * r0}" y1="${cy - Math.cos(a) * r0}" x2="${cx + Math.sin(a) * r * 0.96}" y2="${cy - Math.cos(a) * r * 0.96}" stroke="${long ? C.navy : "#B9C0CF"}" stroke-width="${r * (long ? 0.035 : 0.018)}"/>`;
  }).join("");
  const nums = numerals
    ? Array.from({ length: 12 }, (_, i) => {
        const a = ((i + 1) / 12) * 2 * Math.PI;
        return `<text x="${cx + Math.sin(a) * r * 0.7}" y="${cy - Math.cos(a) * r * 0.7 + r * 0.085}" font-family="Arial" font-weight="bold" font-size="${r * 0.22}" fill="${C.navy}" text-anchor="middle">${i + 1}</text>`;
      }).join("")
    : "";
  return `<circle cx="${cx + r * 0.05}" cy="${cy + r * 0.07}" r="${r * 1.13}" fill="#00000018"/><circle cx="${cx}" cy="${cy}" r="${r * 1.12}" fill="${rim}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff"/>${ticks}${nums}${hands}<circle cx="${cx}" cy="${cy}" r="${r * 0.075}" fill="${C.navy}"/>`;
}
export function clock(name: string, wPt: number, hPt: number, hhmm: string, rim: string = C.teal) {
  return draw(`clock-${name}-${hhmm.replace(":", "")}-${rim.slice(1)}`, wPt, hPt, (W, H) => clockSvg(W / 2, H / 2, Math.min(W, H) * 0.43, hhmm, rim));
}
/** The "time words" clock: the past half (right) and the to half (left) tinted, five-minute dots. */
export function timeWordsClock(wPt: number, hPt: number) {
  return draw("time-words-clock", wPt, hPt, (W, H) => {
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(W, H) * 0.46;
    const half = (side: 1 | -1, fill: string) => `<path d="M${cx} ${cy - r} A${r} ${r} 0 0 ${side === 1 ? 1 : 0} ${cx} ${cy + r} Z" fill="${fill}"/>`;
    const dots = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * 2 * Math.PI;
      return `<circle cx="${cx + Math.sin(a) * r * 0.88}" cy="${cy - Math.cos(a) * r * 0.88}" r="${r * 0.045}" fill="${C.navy}"/>`;
    }).join("");
    return `<circle cx="${cx + r * 0.04}" cy="${cy + r * 0.05}" r="${r * 1.02}" fill="#00000014"/>${half(1, "#FFD9CF")}${half(-1, "#CDEFEE")}<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.navy}" stroke-width="${r * 0.03}"/><line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}" stroke="${C.navy}" stroke-width="${r * 0.015}" stroke-dasharray="${r * 0.05} ${r * 0.04}"/>${dots}${clockSvg(cx, cy, r * 0.55, "", C.sun, { numerals: false })}`;
  });
}

// --- the kite (series mark) -------------------------------------------------------------------
export function kiteSvg(x: number, y: number, s: number, tail = true) {
  // a diamond kite, four panels, a bow tail; s = height of the diamond
  const w = s * 0.72;
  const top = [x, y];
  const right = [x + w / 2, y + s * 0.38];
  const bottom = [x, y + s];
  const left = [x - w / 2, y + s * 0.38];
  const mid = [x, y + s * 0.38];
  const tri = (a: number[], b: number[], c: number[], f: string) => `<polygon points="${a.join(",")} ${b.join(",")} ${c.join(",")}" fill="${f}"/>`;
  const bow = (bx: number, by: number, f: string) => `<path d="M${bx} ${by} l${-s * 0.07} ${-s * 0.04} v${s * 0.08} Z M${bx} ${by} l${s * 0.07} ${-s * 0.04} v${s * 0.08} Z" fill="${f}"/>`;
  const tailPath = tail ? `<path d="M${bottom[0]} ${bottom[1]} q${s * 0.18} ${s * 0.2} ${-s * 0.02} ${s * 0.38} t${s * 0.05} ${s * 0.36}" fill="none" stroke="${C.navy}" stroke-width="${s * 0.018}"/>${bow(bottom[0] + s * 0.07, bottom[1] + s * 0.17, C.coral)}${bow(bottom[0] + s * 0.0, bottom[1] + s * 0.4, C.sun)}${bow(bottom[0] + s * 0.05, bottom[1] + s * 0.62, C.teal)}` : "";
  return `${tailPath}${tri(top, right, mid, C.coral)}${tri(top, left, mid, C.sun)}${tri(left, bottom, mid, C.teal)}${tri(right, bottom, mid, C.lilac)}<polygon points="${top.join(",")} ${right.join(",")} ${bottom.join(",")} ${left.join(",")}" fill="none" stroke="${C.navy}" stroke-width="${s * 0.025}" stroke-linejoin="round"/><line x1="${top[0]}" y1="${top[1]}" x2="${bottom[0]}" y2="${bottom[1]}" stroke="${C.navy}" stroke-width="${s * 0.015}"/><line x1="${left[0]}" y1="${left[1]}" x2="${right[0]}" y2="${right[1]}" stroke="${C.navy}" stroke-width="${s * 0.015}"/>`;
}
export function kite(name: string, wPt: number, hPt: number, tail = true) {
  return draw(`kite-${name}-${tail ? 1 : 0}`, wPt, hPt, (W, H) => {
    const s = tail ? Math.min(H / 2.05, W / 0.8) : Math.min(H * 0.98, W / 0.74);
    return kiteSvg(W / 2, (H - (tail ? s * 2.0 : s)) / 2 + 1, s, tail);
  });
}

// --- the class corner (Ex 18): exactly CORNER --------------------------------------------------------
export function classCorner(wPt: number, hPt: number) {
  return draw(`class-corner-${CORNER.posters}-${CORNER.windows}`, wPt, hPt, (W, H) => {
    const u = W / 100;
    const floorY = H * 0.72;
    let s = `<rect width="${W}" height="${H}" fill="#FFF3D6"/><rect y="${floorY}" width="${W}" height="${H - floorY}" fill="#E8C9A0"/><rect y="${floorY - u * 0.8}" width="${W}" height="${u * 1.6}" fill="#C9A27A"/>`;
    // windows (2)
    for (let i = 0; i < CORNER.windows; i++) {
      const x = u * (6 + i * 20);
      s += `<rect x="${x}" y="${H * 0.12}" width="${u * 15}" height="${H * 0.34}" rx="${u}" fill="#ffffff"/><rect x="${x + u}" y="${H * 0.12 + u}" width="${u * 13}" height="${H * 0.34 - 2 * u}" fill="#BFE6FB"/><line x1="${x + u * 7.5}" y1="${H * 0.12}" x2="${x + u * 7.5}" y2="${H * 0.46}" stroke="#ffffff" stroke-width="${u * 0.9}"/><line x1="${x}" y1="${H * 0.29}" x2="${x + u * 15}" y2="${H * 0.29}" stroke="#ffffff" stroke-width="${u * 0.9}"/>`;
    }
    // clock (1)
    s += clockSvg(u * 52, H * 0.16, u * 4.6, "10:10", C.coral, { numerals: false });
    // posters (3)
    const pc = [C.coral, C.teal, C.lilac];
    for (let i = 0; i < CORNER.posters; i++) {
      const x = u * (60 + i * 13);
      const y = H * (0.1 + (i % 2) * 0.05);
      s += `<rect x="${x + u * 0.4}" y="${y + u * 0.5}" width="${u * 10}" height="${H * 0.27}" fill="#00000018"/><rect x="${x}" y="${y}" width="${u * 10}" height="${H * 0.27}" fill="#ffffff" stroke="${pc[i]}" stroke-width="${u * 0.7}"/><circle cx="${x + u * 5}" cy="${y + H * 0.09}" r="${u * 2.6}" fill="${pc[i]}"/><rect x="${x + u * 1.8}" y="${y + H * 0.17}" width="${u * 6.4}" height="${u * 0.9}" fill="#C7CCD8"/><rect x="${x + u * 1.8}" y="${y + H * 0.21}" width="${u * 4.6}" height="${u * 0.9}" fill="#C7CCD8"/>`;
    }
    // bookcase (1)
    const bx = u * 4;
    const bw = u * 22;
    const bt = H * 0.5;
    s += `<rect x="${bx}" y="${bt}" width="${bw}" height="${H * 0.4}" fill="#8D5A3B"/><rect x="${bx + u}" y="${bt + u}" width="${bw - 2 * u}" height="${H * 0.4 - 2 * u}" fill="#B07A52"/>`;
    for (let sh = 0; sh < 3; sh++) {
      const sy = bt + u + sh * ((H * 0.4 - 2 * u) / 3);
      const shH = (H * 0.4 - 2 * u) / 3;
      s += `<rect x="${bx + u}" y="${sy + shH - u * 0.8}" width="${bw - 2 * u}" height="${u * 0.8}" fill="#6D4429"/>`;
      const cols = ["#E53935", "#1E88E5", "#FDD835", "#43A047", "#8E24AA", "#FB8C00"];
      for (let b = 0; b < 6; b++) s += `<rect x="${bx + u * (1.6 + b * 3.1)}" y="${sy + shH * 0.22 + (b % 2) * u * 0.6}" width="${u * 2.5}" height="${shH * 0.7 - (b % 2) * u * 0.6}" fill="${cols[(b + sh) % 6]}"/>`;
    }
    // teacher's desk with 2 chairs
    const dx = u * 34;
    s += `<rect x="${dx}" y="${H * 0.62}" width="${u * 30}" height="${u * 2.4}" fill="#A86B43"/><rect x="${dx + u}" y="${H * 0.62 + u * 2.4}" width="${u * 2}" height="${H * 0.25}" fill="#8D5A3B"/><rect x="${dx + u * 27}" y="${H * 0.62 + u * 2.4}" width="${u * 2}" height="${H * 0.25}" fill="#8D5A3B"/>`;
    for (let c = 0; c < CORNER.chairs; c++) {
      const cx2 = u * (70 + c * 14);
      s += `<rect x="${cx2}" y="${H * 0.52}" width="${u * 9}" height="${H * 0.16}" rx="${u}" fill="${C.teal}"/><rect x="${cx2}" y="${H * 0.67}" width="${u * 9}" height="${u * 2}" fill="${C.tealDark}"/><rect x="${cx2 + u * 0.6}" y="${H * 0.67 + u * 2}" width="${u * 1.4}" height="${H * 0.2}" fill="#5B6476"/><rect x="${cx2 + u * 7}" y="${H * 0.67 + u * 2}" width="${u * 1.4}" height="${H * 0.2}" fill="#5B6476"/>`;
    }
    // rubbish bin (not counted in Ex 18)
    s += `<path d="M${u * 93} ${H * 0.74} h${u * 6} l${-u * 0.8} ${H * 0.16} h${-u * 4.4} Z" fill="#78909C"/>`;
    return s;
  });
}

// --- the Art cupboard (WB): exactly CUPBOARD, doors open --------------------------------------------
export function artCupboard(wPt: number, hPt: number) {
  return draw(`art-cupboard-${CUPBOARD.brushes}-${CUPBOARD.paintPots}-${CUPBOARD.glueSticks}-${CUPBOARD.aprons}`, wPt, hPt, (W, H) => {
    const u = W / 100;
    const x0 = u * 18;
    const x1 = u * 82;
    const y0 = H * 0.06;
    const y1 = H * 0.96;
    const shelfY = [y0 + (y1 - y0) * 0.36, y0 + (y1 - y0) * 0.68];
    let s = `<rect width="${W}" height="${H}" fill="#EAF6F6"/>`;
    // the open doors
    s += `<polygon points="${x0},${y0} ${u * 4},${y0 + H * 0.05} ${u * 4},${y1 - H * 0.05} ${x0},${y1}" fill="#A8D8D4" stroke="${C.tealDark}" stroke-width="${u * 0.6}"/><polygon points="${x1},${y0} ${u * 96},${y0 + H * 0.05} ${u * 96},${y1 - H * 0.05} ${x1},${y1}" fill="#A8D8D4" stroke="${C.tealDark}" stroke-width="${u * 0.6}"/>`;
    s += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="#FFFFFF" stroke="${C.tealDark}" stroke-width="${u * 0.9}"/>`;
    for (const sy of shelfY) s += `<rect x="${x0}" y="${sy}" width="${x1 - x0}" height="${u * 1.6}" fill="${C.tealDark}"/>`;
    // top shelf: paint pots (3)
    const pots = ["#E53935", "#1E88E5", "#FDD835"];
    for (let i = 0; i < CUPBOARD.paintPots; i++) {
      const cx = x0 + (x1 - x0) * (0.2 + i * 0.3);
      const pw = u * 11;
      const ph = H * 0.14;
      s += `<rect x="${cx - pw / 2}" y="${shelfY[0] - ph}" width="${pw}" height="${ph}" rx="${u}" fill="#ffffff" stroke="#607080" stroke-width="${u * 0.5}"/><rect x="${cx - pw / 2}" y="${shelfY[0] - ph}" width="${pw}" height="${ph * 0.35}" rx="${u}" fill="${pots[i]}"/><rect x="${cx - pw / 2 - u}" y="${shelfY[0] - ph - u * 1.6}" width="${pw + 2 * u}" height="${u * 2}" rx="${u * 0.6}" fill="${pots[i]}"/>`;
    }
    // middle shelf: a jar with brushes (5) and glue sticks (2)
    const jx = x0 + (x1 - x0) * 0.28;
    const jw = u * 16;
    const jh = H * 0.13;
    for (let i = 0; i < CUPBOARD.brushes; i++) {
      const bx = jx - jw * 0.36 + (i * jw * 0.72) / (CUPBOARD.brushes - 1);
      const tilt = (i - 2) * 5;
      s += `<g transform="rotate(${tilt} ${bx} ${shelfY[1] - jh})"><rect x="${bx - u * 0.8}" y="${shelfY[1] - jh - H * 0.15}" width="${u * 1.6}" height="${H * 0.15}" fill="#A0522D"/><rect x="${bx - u * 1.1}" y="${shelfY[1] - jh - H * 0.19}" width="${u * 2.2}" height="${H * 0.05}" rx="${u}" fill="${["#E53935", "#43A047", "#1E88E5", "#FB8C00", "#8E24AA"][i]}"/></g>`;
    }
    s += `<rect x="${jx - jw / 2}" y="${shelfY[1] - jh}" width="${jw}" height="${jh}" rx="${u * 1.5}" fill="#CFE8F7" stroke="#607080" stroke-width="${u * 0.5}" opacity="0.95"/>`;
    for (let i = 0; i < CUPBOARD.glueSticks; i++) {
      const gx = x0 + (x1 - x0) * (0.62 + i * 0.2);
      s += `<rect x="${gx - u * 3}" y="${shelfY[1] - H * 0.15}" width="${u * 6}" height="${H * 0.15}" rx="${u * 1.2}" fill="#FFFFFF" stroke="#607080" stroke-width="${u * 0.5}"/><rect x="${gx - u * 3}" y="${shelfY[1] - H * 0.15}" width="${u * 6}" height="${H * 0.04}" rx="${u * 1.2}" fill="#7E57C2"/>`;
    }
    // bottom: an apron (1) on a hook
    const ax = x0 + (x1 - x0) * 0.5;
    const at = shelfY[1] + H * 0.05;
    s += `<circle cx="${ax}" cy="${at}" r="${u * 1.2}" fill="#607080"/><path d="M${ax - u * 5} ${at + u * 1.5} h${u * 10} l${u * 4} ${H * 0.07} l${-u * 2} ${H * 0.12} h${-u * 14} l${-u * 2} ${-H * 0.12} Z" fill="${C.coral}"/><rect x="${ax - u * 4}" y="${at + H * 0.1}" width="${u * 8}" height="${H * 0.05}" rx="${u}" fill="#FFD9CF"/>`;
    return s;
  });
}

// --- the board game (SB p. 12)------------------------------------------------------------------
/** Square centres for n squares on a snake path, as fractions of the board. */
export function boardCells(n: number, cols = 5) {
  const rows = Math.ceil(n / cols);
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols);
    const k = i % cols;
    const c = r % 2 === 0 ? k : cols - 1 - k;
    return { r, c, x: (c + 0.5) / cols, y: (rows - 1 - r + 0.5) / rows };
  });
}
export function boardGround(wPt: number, hPt: number, n: number, kinds: (string | undefined)[], cols = 5) {
  return draw(`board2-${n}-${cols}`, wPt, hPt, (W, H) => {
    const rows = Math.ceil(n / cols);
    const cw = W / cols;
    const ch = H / rows;
    const cells = boardCells(n, cols);
    let s = `<rect width="${W}" height="${H}" rx="${cw * 0.12}" fill="${C.tealTint}"/>`;
    // path ribbon behind the squares
    const pts = cells.map((c) => `${c.x * W},${c.y * H}`).join(" ");
    s += `<polyline points="${pts}" fill="none" stroke="${C.sun}" stroke-width="${ch * 0.42}" stroke-linejoin="round" stroke-linecap="round"/>`;
    const fills = ["#ffffff", "#FFF5D6", "#ffffff", "#E2F5F4"];
    cells.forEach((c, i) => {
      const k = kinds[i];
      const fill = k === "start" || k === "end" ? "#B83A20" : k === "back" ? "#FFE0E0" : k === "fwd" || k === "help" ? "#DFF3DD" : fills[i % 4];
      const x = c.c * cw + cw * 0.06;
      const y = (rows - 1 - c.r) * ch + ch * 0.07;
      s += `<rect x="${x + cw * 0.02}" y="${y + ch * 0.03}" width="${cw * 0.88}" height="${ch * 0.86}" rx="${cw * 0.1}" fill="#00000020"/><rect x="${x}" y="${y}" width="${cw * 0.88}" height="${ch * 0.86}" rx="${cw * 0.1}" fill="${fill}" stroke="${C.tealDark}" stroke-width="${cw * 0.018}"/>`;
    });
    return s;
  });
}

// --- placeholders (stand-ins at the final size until the paid pictures exist) ----------------------------
export function placeholder(name: string, wPt: number, hPt: number, label: string, tint: string = C.sky) {
  return draw(`ph-${name}`, wPt, hPt, (W, H) => {
    const u = Math.min(W, H) / 100;
    const lines = wrap(label, Math.max(14, Math.round(W / (u * 4.2))));
    const fs2 = Math.min(u * 6.5, (H * 0.6) / Math.max(1, lines.length) / 1.3);
    const hatch = Array.from({ length: Math.ceil((W + H) / (u * 8)) }, (_, i) => `<line x1="${i * u * 8}" y1="0" x2="${i * u * 8 - H}" y2="${H}" stroke="#ffffff" stroke-width="${u * 1.6}" opacity="0.55"/>`).join("");
    return `<rect width="${W}" height="${H}" fill="${tint}"/>${hatch}<rect x="${u}" y="${u}" width="${W - 2 * u}" height="${H - 2 * u}" fill="none" stroke="${C.navy}" stroke-width="${u * 0.5}" stroke-dasharray="${u * 3} ${u * 2}" opacity="0.5"/>${lines.map((l, i) => `<text x="${W / 2}" y="${H / 2 + (i - (lines.length - 1) / 2) * fs2 * 1.3 + fs2 * 0.35}" font-family="Arial" font-size="${fs2}" fill="${C.navy}" text-anchor="middle" opacity="0.75">${esc(l)}</text>`).join("")}`;
  });
}
function wrap(s: string, n: number) {
  const out: string[] = [];
  let cur = "";
  for (const w of s.split(" ")) {
    if ((cur + " " + w).trim().length > n) {
      out.push(cur.trim());
      cur = w;
    } else cur += " " + w;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** The placeholder of the opening classroom scene: the objects drawn where their number tags sit. */
export function scenePlaceholder(wPt: number, hPt: number, tags: { n: number; x: number; y: number; label: string }[], people: { x: number; y: number; who: string; colour: string }[]) {
  return draw(`ph-scene-${tags.length}-${people.length}`, wPt, hPt, (W, H) => {
    const u = W / 100;
    let s = `<rect width="${W}" height="${H}" fill="#DCEFF7"/><rect y="${H * 0.66}" width="${W}" height="${H * 0.34}" fill="#E9D3B4"/>`;
    for (const t of tags) s += `<rect x="${t.x * W - u * 4}" y="${t.y * H - u * 3}" width="${u * 8}" height="${u * 6}" rx="${u}" fill="#ffffff" opacity="0.85" stroke="${C.navy}" stroke-width="${u * 0.15}" stroke-dasharray="${u * 0.6} ${u * 0.4}"/><text x="${t.x * W}" y="${t.y * H + u * 3.9}" font-family="Arial" font-size="${u * 1.2}" fill="${C.navy}" text-anchor="middle">${esc(t.label)}</text>`;
    for (const p of people) s += `<circle cx="${p.x * W}" cy="${p.y * H}" r="${u * 2.4}" fill="${p.colour}"/><rect x="${p.x * W - u * 2.6}" y="${p.y * H + u * 2.6}" width="${u * 5.2}" height="${u * 8}" rx="${u * 1.4}" fill="${p.colour}"/><text x="${p.x * W}" y="${p.y * H + u * 13}" font-family="Arial" font-size="${u * 1.3}" fill="${C.navy}" text-anchor="middle">${esc(p.who)}</text>`;
    s += `<text x="${W * 0.5}" y="${H * 0.95}" font-family="Arial" font-size="${u * 1.4}" fill="${C.navy}" text-anchor="middle" opacity="0.7">PICTURE TO COME: the 5/C classroom on Monday morning (placeholder)</text>`;
    return s;
  });
}

// --- picture helpers -----------------------------------------------------------------------------
/** The white card ground of a generated card knocked out. */
export async function knockout(buf: Buffer) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  knockOutside(data, info.width, info.height);
  return sharp(data, { raw: info }).png().toBuffer();
}
/** A picture cut to a circle (avatars). */
export async function circleCrop(name: string, buf: Buffer, dPx: number, ring: string, opt: { top?: number; zoom?: number } = {}) {
  return cached(`circle-${name}-${dPx}-${ring.slice(1)}`, async () => {
    const d = Math.round(dPx);
    const meta = await sharp(buf).metadata();
    const iw = meta.width ?? 1;
    const ih = meta.height ?? 1;
    // a square from the top part of the figure (the face)
    const side = Math.round(Math.min(iw, ih) / (opt.zoom ?? 1));
    const left = Math.max(0, Math.round((iw - side) / 2));
    const top = Math.max(0, Math.min(ih - side, Math.round((opt.top ?? 0) * ih)));
    const face = await sharp(buf).extract({ left, top, width: Math.min(side, iw - left), height: Math.min(side, ih - top) }).resize(d, d, { fit: "cover" }).png().toBuffer();
    const ground = svg(d, d, `<circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="#ffffff"/>`);
    const masked = await sharp(ground).composite([{ input: face }, { input: svg(d, d, `<circle cx="${d / 2}" cy="${d / 2}" r="${d / 2 - 1}" fill="#fff"/>`), blend: "dest-in" }]).png().toBuffer();
    return sharp(masked).composite([{ input: svg(d, d, `<circle cx="${d / 2}" cy="${d / 2}" r="${d / 2 - d * 0.03}" fill="none" stroke="${ring}" stroke-width="${d * 0.06}"/>`) }]).png().toBuffer();
  });
}
/** A placeholder avatar: a tinted disc with the name's first letter. */
export function avatarPlaceholder(name: string, dPt: number, colour: string) {
  return draw(`ph-avatar-${name}`, dPt, dPt, (W) => `<circle cx="${W / 2}" cy="${W / 2}" r="${W / 2}" fill="${colour}"/><circle cx="${W / 2}" cy="${W * 0.4}" r="${W * 0.17}" fill="#ffffff" opacity="0.9"/><path d="M${W * 0.22} ${W * 0.86} q${W * 0.28} ${-W * 0.42} ${W * 0.56} 0" fill="#ffffff" opacity="0.9"/>`);
}
/** Cut a spread picture into the left and right page parts, each with the bleed at both sides (the inner bleed continues the picture across the fold). */
export async function splitSpread(name: string, buf: Buffer, pageW: number, bleed: number, hPt: number) {
  const totalW = 2 * pageW + 2 * bleed;
  const meta = await sharp(buf).metadata();
  const iw = meta.width ?? 1;
  const ih = meta.height ?? 1;
  // cover-fit the spread box into the picture: px per pt
  const scale = Math.min(iw / totalW, ih / hPt);
  const cw = Math.min(iw, Math.floor(totalW * scale));
  const ch = Math.min(ih, Math.floor(hPt * scale));
  const left0 = Math.floor((iw - cw) / 2);
  const top0 = Math.floor((ih - ch) / 2);
  const pw = Math.floor((pageW + 2 * bleed) * scale);
  const part = (fromPt: number) =>
    cached(`spread-${name}-${Math.round(fromPt)}-${cw}x${ch}`, async () => {
      const left = Math.min(iw - pw, left0 + Math.round(fromPt * scale));
      return sharp(buf).extract({ left, top: top0, width: pw, height: ch }).png().toBuffer();
    });
  return { left: await part(0), right: await part(pageW) };
}
