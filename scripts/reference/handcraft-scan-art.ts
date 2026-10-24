// Free, deterministic artwork for the hand-made book re-made from the
// phone-scanned coursebook (handcraft-scan.tsx): sharp + SVG only, no model
// calls. Picture areas are built at the size of the scan page's picture box
// (3 px per pt), the way a publisher's designer builds one artwork per box:
// the laptop keyboard, paint pots, number tiles, clothes pegs, clocks, the
// greetings panel, the bus-stop queue, panels (e-mail window, postcard).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.join(process.cwd(), ".handmade-scan");
export const IMG_DIR = path.join(ROOT, "img"); // paid (handcraft-scan-images.mts)
export const FREE_DIR = path.join(ROOT, "free"); // reused from earlier hand-made books
const COMP_DIR = path.join(ROOT, "comp");
// Free pictures made for the hand-made i5 book (same generator, already paid
// for): copied in once from wherever they are found.
const FREE_SOURCES = [
  path.join(process.cwd(), ".handmade", "img"),
  path.resolve(process.cwd(), "..", "agent-abac43d9f05549743", ".handmade", "img"),
  path.resolve(process.cwd(), "..", "..", "..", ".spike", "handcraft2", "img"),
];

export const img = (name: string) => fs.readFileSync(path.join(IMG_DIR, `${name}.png`));
export function free(name: string) {
  const file = path.join(FREE_DIR, `${name}.png`);
  if (!fs.existsSync(file)) {
    const from = FREE_SOURCES.map((d) => path.join(d, `${name}.png`)).find((f) => fs.existsSync(f));
    if (!from) throw new Error(`free picture ${name} not found`);
    fs.mkdirSync(FREE_DIR, { recursive: true });
    fs.copyFileSync(from, file);
  }
  return fs.readFileSync(file);
}

export const PX = 3; // px per pt
export const svg = (w: number, h: number, body: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(h)}" viewBox="0 0 ${Math.round(w)} ${Math.round(h)}">${body}</svg>`);

type Layer = { input: Buffer; left: number; top: number };
export async function canvas(w: number, h: number, layers: Layer[], bg = { r: 255, g: 255, b: 255, alpha: 0 }) {
  return sharp({ create: { width: Math.round(w), height: Math.round(h), channels: 4, background: bg } })
    .composite(layers.map((l) => ({ ...l, left: Math.round(l.left), top: Math.round(l.top) })))
    .png()
    .toBuffer();
}
export const contain = (buf: Buffer, w: number, h: number) =>
  sharp(buf).resize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
// White card background knocked out, so a cut-out sits on any colour.
export async function knockout(buf: Buffer) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const m = Math.min(data[i], data[i + 1], data[i + 2]);
    if (m > 244) data[i + 3] = 0;
    else if (m > 232) data[i + 3] = Math.round(((244 - m) / 12) * 255);
  }
  return sharp(data, { raw: info }).png().toBuffer();
}
export async function circle(buf: Buffer, d: number, ring = "#ffffff", ringW = 8, bg?: string) {
  d = Math.round(d);
  let face = await sharp(buf).resize(d, d, { fit: "cover", position: "top" }).png().toBuffer();
  if (bg) face = await canvas(d, d, [{ input: svg(d, d, `<rect width="${d}" height="${d}" fill="${bg}"/>`), left: 0, top: 0 }, { input: await knockout(face), left: 0, top: 0 }]);
  const masked = await sharp(face)
    .composite([{ input: svg(d, d, `<circle cx="${d / 2}" cy="${d / 2}" r="${d / 2 - 1}" fill="#fff"/>`), blend: "dest-in" }])
    .png()
    .toBuffer();
  return canvas(d, d, [{ input: masked, left: 0, top: 0 }, ...(ringW ? [{ input: svg(d, d, `<circle cx="${d / 2}" cy="${d / 2}" r="${d / 2 - ringW / 2}" fill="none" stroke="${ring}" stroke-width="${ringW}"/>`), left: 0, top: 0 }] : [])]);
}
export async function rounded(buf: Buffer, w: number, h: number, r: number, position = "centre") {
  w = Math.round(w);
  h = Math.round(h);
  const base = await sharp(buf).resize(w, h, { fit: "cover", position }).png().toBuffer();
  return sharp(base).composite([{ input: svg(w, h, `<rect width="${w}" height="${h}" rx="${r}" fill="#fff"/>`), blend: "dest-in" }]).png().toBuffer();
}
export function hexRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, alpha: 1 };
}
export async function crop(buf: Buffer, x: number, y: number, w: number, h: number) {
  const m = await sharp(buf).metadata();
  const W = m.width ?? 1;
  const H = m.height ?? 1;
  return sharp(buf)
    .extract({ left: Math.round(x * W), top: Math.round(y * H), width: Math.round(w * W), height: Math.round(h * H) })
    .png()
    .toBuffer();
}
// A card slice with its white margin cut away (so a cut-out fills its box).
export const trim = (buf: Buffer) => sharp(buf).trim({ background: "#ffffff", threshold: 18 }).png().toBuffer();
// The same picture printed a little more saturated (the scan's artwork is brighter).
export const vivid = (buf: Buffer, saturation = 1.25) => sharp(buf).modulate({ saturation }).png().toBuffer();

export async function cached(name: string, make: () => Promise<Buffer>): Promise<Buffer> {
  fs.mkdirSync(COMP_DIR, { recursive: true });
  const file = path.join(COMP_DIR, `${name}.png`);
  if (fs.existsSync(file) && !process.env.REBUILD_ART) return fs.readFileSync(file);
  const buf = await make();
  fs.writeFileSync(file, buf);
  return buf;
}

// One artwork for a picture box: a drawn SVG ground with pictures on it.
export type Placed = { buf: Buffer; x: number; y: number; w: number; h: number; fit?: "contain" | "cover"; round?: number; circle?: boolean; ring?: string; ringW?: number; bg?: string; knock?: boolean; rot?: number; pos?: string };
export async function compose(name: string, w: number, h: number, ground: string, items: Placed[] = [], over = "") {
  return cached(name, async () => {
    const layers: Layer[] = [{ input: svg(w, h, ground), left: 0, top: 0 }];
    for (const p of items) {
      let b: Buffer;
      if (p.circle) b = await circle(p.buf, Math.min(p.w, p.h), p.ring ?? "#fff", p.ringW ?? 8, p.bg);
      else if (p.fit === "cover") b = await rounded(p.buf, p.w, p.h, p.round ?? 0, p.pos);
      else b = await contain(p.knock ? await knockout(p.buf) : p.buf, p.w, p.h);
      if (p.rot) b = await sharp(b).rotate(p.rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      layers.push({ input: b, left: p.x, top: p.y });
    }
    if (over) layers.push({ input: svg(w, h, over), left: 0, top: 0 });
    return canvas(w, h, layers);
  });
}

// --- Starter -------------------------------------------------------------------

// The laptop seen from above, keys lettered A-Z with the secret-message
// numbers on some keys (exercise 1 of the alphabet page). Letters are
// upper case; the pupils write the lower-case letters on the key lines.
export const SECRET: Record<string, number> = { W: 1, E: 2, C: 3, A: 4, N: 5, D: 6, O: 7, I: 8, T: 9 };
export function keyboard(w: number, h: number) {
  return cached("keyboard", async () => {
    const W = Math.round(w * PX);
    const H = Math.round(h * PX);
    const k = W / 1500;
    const key = (x: number, y: number, kw: number, label = "", sub = "", num?: number, kh = 78) =>
      `<rect x="${x * k}" y="${y * k}" width="${kw * k}" height="${kh * k}" rx="${10 * k}" fill="#FDFDFD" stroke="#B0B6BE" stroke-width="${3 * k}"/>` +
      (label ? `<text x="${(x + 14) * k}" y="${(y + 36) * k}" font-family="Arial" font-size="${30 * k}" fill="#37474F">${label}</text>` : "") +
      (sub === "_" ? `<line x1="${(x + 14) * k}" x2="${(x + kw - 14) * k}" y1="${(y + 66) * k}" y2="${(y + 66) * k}" stroke="#78909C" stroke-width="${3 * k}"/>` : sub ? `<text x="${(x + kw - 12) * k}" y="${(y + kh - 10) * k}" font-family="Arial" font-size="${18 * k}" fill="#90A4AE" text-anchor="end">${sub}</text>` : "") +
      (num ? `<rect x="${(x + kw - 34) * k}" y="${(y + 4) * k}" width="${30 * k}" height="${30 * k}" rx="${7 * k}" fill="#E5195A"/><text x="${(x + kw - 19) * k}" y="${(y + 27) * k}" font-family="Arial" font-weight="bold" font-size="${24 * k}" fill="#fff" text-anchor="middle">${num}</text>` : "");
    let keys = "";
    const fn = ["ESC", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"];
    fn.forEach((f, i) => (keys += key(150 + i * 82, 330, 74, "", f, undefined, 50)));
    "1234567890".split("").forEach((d, i) => (keys += key(150 + i * 88, 400, 80, d)));
    keys += key(150 + 10 * 88, 400, 150, "", "BACK");
    const rows = ["ABCDEFGHIJ", "KLMNOPQRS", "TUVWXYZ"];
    rows.forEach((r, ri) => {
      const x0 = 210 + ri * 40;
      if (ri === 0) keys += key(150, 488, 52, "", "TAB");
      if (ri === 1) keys += key(150, 576, 92, "", "CAPS");
      if (ri === 2) keys += key(150, 664, 132, "", "SHIFT");
      r.split("").forEach((c, i) => {
        const x = x0 + (ri === 2 ? 90 : ri === 1 ? 50 : 10) + i * 88;
        keys += key(x, 488 + ri * 88, 80, c, c === "A" ? "" : "_", SECRET[c]);
        if (c === "A") keys += `<text x="${(x + 40) * k}" y="${(488 + 68) * k}" font-family="Comic Sans MS, Arial" font-size="${30 * k}" fill="#C62828" text-anchor="middle">a</text>`;
      });
    });
    keys += key(1080, 488, 150, "", "ENTER") + key(1060, 576, 170, "") + key(980, 664, 250, "", "SHIFT");
    keys += key(150, 752, 92, "", "CTRL") + key(250, 752, 92, "", "ALT") + key(350, 752, 560, "") + key(920, 752, 92, "", "ALT") + key(1020, 752, 92, "", "CTRL");
    // number pad
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) keys += key(1290 + c * 70, 400 + r * 88, 62, ["789", "456", "123", "0.."][r][c]);
    const body = `<defs><linearGradient id="lap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEF1F4"/><stop offset="1" stop-color="#D5DAE0"/></linearGradient>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7F4EC"/><stop offset="1" stop-color="#E8EEF5"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      <rect x="${110 * k}" y="${40 * k}" width="${1290 * k}" height="${150 * k}" rx="${30 * k}" fill="#C9CED5"/><rect x="${200 * k}" y="${70 * k}" width="${1100 * k}" height="${60 * k}" rx="${12 * k}" fill="#5F6B78"/>
      <rect x="${60 * k}" y="${200 * k}" width="${1440 * k}" height="${780 * k}" rx="${40 * k}" fill="url(#lap)" stroke="#AEB5BE" stroke-width="${4 * k}"/>
      <rect x="${130 * k}" y="${230 * k}" width="${1340 * k}" height="${70 * k}" rx="${16 * k}" fill="#DDE1E6"/>
      ${Array.from({ length: 60 }, (_, i) => `<circle cx="${(150 + (i % 30) * 44) * k}" cy="${(250 + Math.floor(i / 30) * 30) * k}" r="${5 * k}" fill="#AAB2BB"/>`).join("")}
      ${keys}
      <rect x="${560 * k}" y="${850 * k}" width="${380 * k}" height="${120 * k}" rx="${18 * k}" fill="#E4E8EC" stroke="#B9C0C8" stroke-width="${4 * k}"/>
      <path d="M0 ${H * 0.86} C ${W * 0.35} ${H * 0.98}, ${W * 0.7} ${H * 0.9}, ${W} ${H * 0.78} L ${W} ${H} L 0 ${H} Z" fill="#FFF3D6"/>
      <path d="M0 ${H * 0.86} C ${W * 0.35} ${H * 0.98}, ${W * 0.7} ${H * 0.9}, ${W} ${H * 0.78}" stroke="#F2B705" stroke-width="${16 * k}" fill="none"/>`;
    return sharp(svg(W, H, body)).png().toBuffer();
  });
}

// A paintbrush dipping into a numbered paint pot, one per colour.
export const PAINTS: [string, string][] = [
  ["red", "#E53935"], ["orange", "#FB8C00"], ["yellow", "#FDD835"],
  ["green", "#43A047"], ["white", "#F5F5F5"], ["blue", "#1E88E5"],
  ["black", "#212121"], ["purple", "#8E24AA"], ["brown", "#8D5524"],
];
export function paintPots(w: number, h: number) {
  return cached("paint-pots", async () => {
    const W = Math.round(w * PX);
    const H = Math.round(h * PX);
    const cw = (W - 60) / 3;
    const ch = (H - 170) / 3;
    let body = `<rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="40" fill="#FFF8EF" stroke="#F6C99A" stroke-width="8"/>`;
    PAINTS.forEach(([, c], i) => {
      const x = 30 + (i % 3) * cw + cw * 0.18;
      const y = 150 + Math.floor(i / 3) * ch;
      const pw = cw * 0.5;
      const ph = ch * 0.42;
      const py = y + ch * 0.24;
      const stroke = c === "#F5F5F5" ? "#BDBDBD" : "#00000033";
      body += `<g transform="rotate(-28 ${x + pw * 0.9} ${y})"><rect x="${x + pw * 0.2}" y="${y - ch * 0.02}" width="${pw * 0.95}" height="${ch * 0.07}" rx="8" fill="#D7A86E"/><rect x="${x + pw * 1.1}" y="${y - ch * 0.035}" width="${pw * 0.28}" height="${ch * 0.1}" rx="4" fill="#9E9E9E"/><path d="M${x + pw * 1.38} ${y - ch * 0.035} q ${pw * 0.3} ${ch * 0.05} 0 ${ch * 0.1} z" fill="${c}" stroke="${stroke}" stroke-width="3"/></g>
        <circle cx="${x + pw * 0.95}" cy="${y + ch * 0.13}" r="${cw * 0.025}" fill="${c}" stroke="${stroke}" stroke-width="2"/>
        <rect x="${x}" y="${py}" width="${pw}" height="${ph}" rx="10" fill="#ECEFF1" stroke="#90A4AE" stroke-width="4"/>
        <ellipse cx="${x + pw / 2}" cy="${py}" rx="${pw / 2}" ry="${ph * 0.12}" fill="#B0BEC5"/>
        <path d="M${x} ${py} h ${pw} v ${ph * 0.32} q ${-pw * 0.12} ${ph * 0.25} ${-pw * 0.22} 0 q ${-pw * 0.18} ${ph * 0.18} ${-pw * 0.3} 0 q ${-pw * 0.16} ${ph * 0.32} ${-pw * 0.28} 0 q ${-pw * 0.1} ${ph * 0.1} ${-pw * 0.2} 0 z" fill="${c}" stroke="${stroke}" stroke-width="3"/>
        <text x="${x + pw / 2}" y="${py + ph * 0.8}" font-family="Comic Sans MS, Arial" font-weight="bold" font-size="${ph * 0.36}" fill="#546E7A" text-anchor="middle">${i + 1}</text>`;
    });
    return sharp(svg(W, H, body)).png().toBuffer();
  });
}

// Number tiles as artwork (big numbers printed as text read as exercises).
export const NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "30", "40", "50", "60", "70", "80", "90", "100"];
const TILE_COLS = ["#EC407A", "#AB47BC", "#FBC02D", "#4FC3F7", "#E91E63", "#7CB342", "#FF7043", "#FFB300", "#F06292", "#7E57C2", "#37474F", "#29B6F6"];
const DIGIT_COLS = ["#fff", "#FFF59D", "#6A1B9A", "#263238", "#3949AB", "#4A148C", "#fff", "#7B1FA2"];
export function numberTiles(w: number, h: number) {
  return cached("number-tiles", async () => {
    const W = Math.round(w * PX);
    const H = Math.round(h * PX);
    const cols = 4;
    const rows = 7;
    const cw = W / cols;
    const ch = H / rows;
    const s = Math.min(cw, ch) * 0.62;
    let body = "";
    NUMBERS.forEach((n, i) => {
      const cx = (i % cols) * cw + cw / 2;
      const cy = Math.floor(i / cols) * ch + ch * 0.4;
      const rot = [-6, 4, -3, 5, -4, 3, -5, 6][i % 8];
      const col = TILE_COLS[(i * 5) % TILE_COLS.length];
      const dig = DIGIT_COLS[i % DIGIT_COLS.length];
      const fs = n.length === 3 ? s * 0.5 : n.length === 2 ? s * 0.62 : s * 0.8;
      body += `<g transform="rotate(${rot} ${cx} ${cy})"><rect x="${cx - s / 2 + 6}" y="${cy - s / 2 + 8}" width="${s}" height="${s}" fill="#00000022"/><path d="M${cx - s / 2} ${cy - s / 2} h ${s * 0.82} l ${s * 0.18} ${s * 0.18} v ${s * 0.82} h ${-s} z" fill="${col}"/>
        <text x="${cx}" y="${cy + fs * 0.36}" font-family="Arial Rounded MT Bold, Arial Black, Arial" font-weight="bold" font-size="${fs}" fill="${dig === col ? "#fff" : dig}" stroke="#ffffff55" stroke-width="2" text-anchor="middle">${n}</text></g>`;
    });
    return sharp(svg(W, H, body)).png().toBuffer();
  });
}

// Seven clothes pegs with a day of the week on each, letters missing.
export const PEG_DAYS = ["_ON_AY", "TU_SD_Y", "W_DN_SD_Y", "TH_RS_AY", "F_I_AY", "SA_U_DAY", "S_ND_Y"];
export function pegs(w: number, h: number) {
  return cached("pegs", async () => {
    const W = Math.round(w * PX);
    const H = Math.round(h * PX);
    const cols = ["#8E24AA", "#795548", "#43A047", "#ECEFF1", "#42A5F5", "#7E7E9A", "#D4E157"];
    const rh = (H - 40) / 7;
    let body = `<rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="36" fill="#FFFDF4" stroke="#F2C230" stroke-width="7"/>`;
    PEG_DAYS.forEach((d, i) => {
      const y = 30 + i * rh;
      const x = 40 + (i % 2) * 30 + (i === 6 ? -20 : 0);
      const pw = W - 120;
      const ph = rh * 0.62;
      const rot = [-6, -2, 2, -3, 4, 5, 12][i];
      const c = cols[i];
      const dark = i === 3 || i === 6 ? "#37474F" : "#fff";
      body += `<g transform="rotate(${rot} ${x + pw / 2} ${y + ph / 2})">
        <rect x="${x + 8}" y="${y + ph * 0.55}" width="${pw}" height="${ph * 0.5}" rx="10" fill="#00000030"/>
        <rect x="${x}" y="${y + ph * 0.18}" width="${pw}" height="${ph * 0.8}" rx="10" fill="${c}" stroke="#00000030" stroke-width="3"/>
        <rect x="${x}" y="${y}" width="${pw * 0.3}" height="${ph * 0.45}" rx="8" fill="${c}" stroke="#00000030" stroke-width="3"/>
        <rect x="${x + pw * 0.3}" y="${y + ph * 0.16}" width="${pw * 0.12}" height="${ph * 0.82}" rx="6" fill="#B0BEC5" stroke="#78909C" stroke-width="3"/>
        <text x="${x + pw * 0.1}" y="${y + ph * 0.78}" font-family="Arial" font-weight="bold" font-size="${ph * 0.42}" fill="${dark}">${i + 1}</text>
        <text x="${x + pw * 0.71}" y="${y + ph * 0.78}" font-family="Arial" font-size="${ph * 0.46}" fill="${dark}" text-anchor="middle" letter-spacing="3">${d}</text></g>`;
    });
    return sharp(svg(W, H, body)).png().toBuffer();
  });
}

// The yellow star wallpaper the scan's p.10-11 print round the page.
export function starGround(w: number, h: number, inset: { top: number; left: number; right: number }) {
  return cached(`star-ground-${inset.left}-${inset.right}`, async () => {
    const W = Math.round(w * 2);
    const H = Math.round(h * 2);
    let stars = "";
    for (let y = 20; y < H; y += 110) for (let x = ((y / 110) % 2) * 55; x < W; x += 110) {
      const r = 26;
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 ? r * 0.45 : r;
        return `${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`;
      }).join(" ");
      stars += `<polygon points="${pts}" fill="#F5E44C" transform="rotate(${(x + y) % 40} ${x} ${y})"/>`;
    }
    const body = `<rect width="${W}" height="${H}" fill="#FDFBD8"/>${stars}
      <rect x="${inset.left * 2}" y="${inset.top * 2}" width="${W - (inset.left + inset.right) * 2}" height="${H}" fill="#EAF4FB"/>
      <rect x="${inset.left * 2}" y="${inset.top * 2}" width="${W - (inset.left + inset.right) * 2}" height="${H * 0.5}" fill="url(#fade)"/>
      <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#EAF4FB"/></linearGradient></defs>`;
    return sharp(svg(W, H, body)).png().toBuffer();
  });
}

function clockFace(cx: number, cy: number, r: number, h: number, m: number, rim: string, red = false) {
  const ma = (m / 60) * 2 * Math.PI;
  const ha = (((h % 12) + m / 60) / 12) * 2 * Math.PI;
  const hand = (a: number, len: number, wdt: number, c: string) =>
    `<line x1="${cx}" y1="${cy}" x2="${cx + Math.sin(a) * len}" y2="${cy - Math.cos(a) * len}" stroke="${c}" stroke-width="${wdt}" stroke-linecap="round"/>`;
  const nums = Array.from({ length: 12 }, (_, i) => {
    const a = ((i + 1) / 12) * 2 * Math.PI;
    return `<text x="${cx + Math.sin(a) * r * 0.76}" y="${cy - Math.cos(a) * r * 0.76 + r * 0.09}" font-family="Arial" font-size="${r * 0.24}" fill="#37474F" text-anchor="middle">${i + 1}</text>`;
  }).join("");
  return `<circle cx="${cx + r * 0.06}" cy="${cy + r * 0.08}" r="${r * 1.17}" fill="#00000022"/><circle cx="${cx}" cy="${cy}" r="${r * 1.15}" fill="${rim}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/>${nums}${hand(ha, r * 0.5, r * 0.09, red ? "#D32F2F" : "#263238")}${hand(ma, r * 0.8, r * 0.06, red ? "#D32F2F" : "#263238")}<circle cx="${cx}" cy="${cy}" r="${r * 0.07}" fill="#263238"/>`;
}
export function clockRow(name: string, w: number, h: number, times: [number, number][], rims: string[], cols: number, red = false, ground = "") {
  return cached(name, async () => {
    const W = Math.round(w * PX);
    const H = Math.round(h * PX);
    const rows = Math.ceil(times.length / cols);
    const cw = W / cols;
    const ch = H / rows;
    const r = Math.min(cw, ch) * 0.36;
    const body = ground.replace(/\$W/g, String(W)).replace(/\$H/g, String(H)) + times.map(([hh, mm], i) => clockFace((i % cols) * cw + cw / 2, Math.floor(i / cols) * ch + ch / 2, r, hh, mm, rims[i % rims.length], red)).join("");
    return sharp(svg(W, H, body)).png().toBuffer();
  });
}

// One school building drawn at four times of day (the greetings panel).
export function schoolAt(name: string, w: number, h: number, time: "morning" | "afternoon" | "evening" | "night" | "day") {
  return cached(name, async () => {
    const W = Math.round(w * PX);
    const H = Math.round(h * PX);
    const sky = { morning: ["#FFF3C4", "#9AD3F5"], afternoon: ["#5EB6F0", "#BFE6FB"], evening: ["#F57F17", "#8E24AA"], night: ["#1A1A4E", "#3F2B8C"], day: ["#8FD3FA", "#D9F1FD"] }[time];
    const sun =
      time === "morning" ? `<circle cx="${W * 0.18}" cy="${H * 0.42}" r="${H * 0.12}" fill="#FFD54F"/>${Array.from({ length: 10 }, (_, i) => `<line x1="${W * 0.18}" y1="${H * 0.42}" x2="${W * 0.18 + Math.cos(i * 0.63) * H * 0.3}" y2="${H * 0.42 - Math.abs(Math.sin(i * 0.63)) * H * 0.3}" stroke="#FFE082" stroke-width="${H * 0.02}"/>`).join("")}`
      : time === "afternoon" || time === "day" ? `<circle cx="${W * 0.55}" cy="${H * 0.16}" r="${H * 0.09}" fill="#FFEB3B"/>`
      : time === "evening" ? `<circle cx="${W * 0.8}" cy="${H * 0.55}" r="${H * 0.14}" fill="#FFB74D"/>`
      : `<circle cx="${W * 0.62}" cy="${H * 0.15}" r="${H * 0.07}" fill="#FFF9C4"/>${Array.from({ length: 14 }, (_, i) => `<circle cx="${((i * 97) % 100) / 100 * W}" cy="${((i * 37) % 40) / 100 * H}" r="${H * 0.008}" fill="#fff"/>`).join("")}`;
    const lit = time === "night" || time === "evening" ? "#FFE082" : "#B3E5FC";
    let win = "";
    for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) win += `<rect x="${W * (0.17 + c * 0.075)}" y="${H * (0.42 + r * 0.12)}" width="${W * 0.045}" height="${H * 0.07}" fill="${lit}" stroke="#5D4037" stroke-width="${H * 0.006}"/>`;
    const body = `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>
      <rect width="${W}" height="${H}" rx="${H * 0.05}" fill="url(#s)"/>${sun}
      <polygon points="${W * 0.12},${H * 0.38} ${W * 0.2},${H * 0.28} ${W * 0.72},${H * 0.28} ${W * 0.8},${H * 0.38}" fill="#8D3B2F"/>
      <rect x="${W * 0.13}" y="${H * 0.37}" width="${W * 0.66}" height="${H * 0.45}" fill="#B5543F"/>${win}
      <rect x="${W * 0.42}" y="${H * 0.66}" width="${W * 0.07}" height="${H * 0.16}" fill="#5D4037"/>
      <rect x="${W * 0.74}" y="${H * 0.12}" width="${W * 0.1}" height="${H * 0.7}" fill="#A1463A"/><polygon points="${W * 0.73},${H * 0.13} ${W * 0.79},${H * 0.03} ${W * 0.85},${H * 0.13}" fill="#6D2B22"/>
      <circle cx="${W * 0.79}" cy="${H * 0.22}" r="${W * 0.035}" fill="#FFFDE7" stroke="#4E342E" stroke-width="${H * 0.008}"/>
      <circle cx="${W * 0.9}" cy="${H * 0.62}" r="${H * 0.16}" fill="${time === "night" ? "#1B5E20" : "#43A047"}"/><circle cx="${W * 0.86}" cy="${H * 0.52}" r="${H * 0.12}" fill="${time === "night" ? "#2E7D32" : "#66BB6A"}"/><rect x="${W * 0.885}" y="${H * 0.7}" width="${W * 0.025}" height="${H * 0.14}" fill="#6D4C41"/>
      <rect x="0" y="${H * 0.82}" width="${W}" height="${H * 0.18}" fill="${time === "night" ? "#455A64" : "#90A4AE"}"/>`;
    return sharp(svg(W, H, body)).png().toBuffer();
  });
}

// Grey city skyline strip (the bus-stop and dialogue grounds).
export function skyline(name: string, w: number, h: number, colour = "#B0BEC5") {
  return cached(name, async () => {
    const W = Math.round(w * PX);
    const H = Math.round(h * PX);
    let b = "";
    let x = 0;
    let i = 0;
    while (x < W) {
      const bw = W * (0.05 + ((i * 37) % 7) / 100);
      const bh = H * (0.35 + ((i * 53) % 50) / 100);
      b += `<rect x="${x}" y="${H - bh}" width="${bw - 6}" height="${bh}" fill="${colour}"/>`;
      for (let wy = H - bh + 20; wy < H - 30; wy += 46) for (let wx = x + 14; wx < x + bw - 30; wx += 34) b += `<rect x="${wx}" y="${wy}" width="16" height="22" fill="#ECEFF1" opacity="0.7"/>`;
      x += bw;
      i++;
    }
    return sharp(svg(W, H, b)).png().toBuffer();
  });
}

// --- panels --------------------------------------------------------------------

export function emailWindow(name: string, w: number, h: number, photo?: Buffer) {
  const W = Math.round(w * PX);
  const H = Math.round(h * PX);
  return compose(
    name,
    W,
    H,
    `<rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="14" fill="#FFFFFF" stroke="#90A4AE" stroke-width="6"/><rect x="4" y="4" width="${W - 8}" height="64" rx="14" fill="#CFD8DC"/><rect x="4" y="40" width="${W - 8}" height="28" fill="#CFD8DC"/>
     ${["#EF5350", "#FFCA28", "#66BB6A", "#42A5F5", "#AB47BC"].map((c, i) => `<circle cx="${40 + i * 40}" cy="36" r="13" fill="${c}"/>`).join("")}
     <rect x="250" y="20" width="${W * 0.45}" height="32" rx="16" fill="#fff"/><text x="270" y="44" font-family="Arial" font-size="20" fill="#546E7A">http://www.penfriends.example</text>
     <rect x="4" y="68" width="${W * 0.3}" height="${H - 72}" fill="#FFB74D"/>`,
    photo ? [{ buf: photo, x: 4, y: 68, w: Math.round(W * 0.3), h: H - 72, fit: "cover", pos: "top" }] : [],
  );
}

export function postcard(name: string, w: number, h: number, landmark: Buffer) {
  const W = Math.round(w * PX);
  const H = Math.round(h * PX);
  // airmail border: slanted red/blue dashes along all four edges
  const edge = (len: number, horiz: boolean, off: number) =>
    Array.from({ length: Math.ceil(len / 40) }, (_, i) => i)
      .map((i) => {
        const c = i % 2 ? "#1E88E5" : "#E53935";
        const a = i * 40;
        return horiz
          ? `<polygon points="${a},${off + 14} ${a + 10},${off} ${a + 32},${off} ${a + 22},${off + 14}" fill="${c}"/>`
          : `<polygon points="${off},${a + 10} ${off + 14},${a} ${off + 14},${a + 22} ${off},${a + 32}" fill="${c}"/>`;
      })
      .join("");
  return compose(
    name,
    W,
    H,
    `<rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="#F8F1E0"/>${edge(W, true, 8)}${edge(W, true, H - 22)}${edge(H, false, 8)}${edge(H, false, W - 22)}
     <rect x="${W - 190}" y="44" width="140" height="160" fill="none" stroke="#8D6E63" stroke-width="4" stroke-dasharray="10 6"/><text x="${W - 120}" y="110" font-family="Arial" font-size="20" fill="#8D6E63" text-anchor="middle">STAMP</text><text x="${W - 120}" y="138" font-family="Arial" font-size="20" fill="#8D6E63" text-anchor="middle">HERE</text>`,
    [{ buf: landmark, x: 40, y: 40, w: Math.round(W * 0.3), h: H - 80, knock: true }],
  );
}

// A row of kids at a bus stop: faces in circles on drawn bodies, a bus on the left.
export function busQueue(name: string, w: number, h: number, faces: Buffer[]) {
  const W = Math.round(w * PX);
  const H = Math.round(h * PX);
  const n = faces.length;
  const x0 = W * 0.36;
  const step = (W - x0 - 20) / n;
  const bodyCols = ["#1E88E5", "#E53935", "#8E24AA", "#43A047", "#FB8C00", "#00ACC1", "#F06292", "#5E35B1"];
  let ground = `<rect x="0" y="${H * 0.93}" width="${W}" height="${H * 0.07}" fill="#9E9E9E"/>`;
  ground += `<g><rect x="${W * 0.02}" y="${H * 0.28}" width="${W * 0.26}" height="${H * 0.64}" rx="${W * 0.03}" fill="#F4511E"/><rect x="${W * 0.04}" y="${H * 0.34}" width="${W * 0.22}" height="${H * 0.22}" rx="12" fill="#B3E5FC" stroke="#37474F" stroke-width="6"/><rect x="${W * 0.06}" y="${H * 0.62}" width="${W * 0.18}" height="${H * 0.05}" rx="6" fill="#FFAB91"/><circle cx="${W * 0.07}" cy="${H * 0.93}" r="${H * 0.06}" fill="#263238"/><circle cx="${W * 0.23}" cy="${H * 0.93}" r="${H * 0.06}" fill="#263238"/><rect x="${W * 0.035}" y="${H * 0.72}" width="${W * 0.04}" height="${H * 0.04}" rx="4" fill="#FFEB3B"/><rect x="${W * 0.225}" y="${H * 0.72}" width="${W * 0.04}" height="${H * 0.04}" rx="4" fill="#FFEB3B"/></g>`;
  ground += `<rect x="${W * 0.31}" y="${H * 0.2}" width="10" height="${H * 0.73}" fill="#607D8B"/><rect x="${W * 0.28}" y="${H * 0.08}" width="${W * 0.07}" height="${H * 0.14}" rx="10" fill="#1E88E5" stroke="#fff" stroke-width="5"/><text x="${W * 0.315}" y="${H * 0.18}" font-family="Arial" font-weight="bold" font-size="${H * 0.035}" fill="#fff" text-anchor="middle">BUS</text>`;
  const items: Placed[] = [];
  faces.forEach((f, i) => {
    const cx = x0 + step * i + step / 2;
    const d = Math.min(step * 0.8, H * 0.24);
    const top = H * 0.36 + (i % 2) * H * 0.04;
    ground += `<rect x="${cx - d * 0.42}" y="${top + d * 0.8}" width="${d * 0.84}" height="${H * 0.27}" rx="${d * 0.25}" fill="${bodyCols[i % 8]}"/><rect x="${cx - d * 0.3}" y="${top + d * 0.8 + H * 0.25}" width="${d * 0.22}" height="${H * 0.93 - (top + d * 0.8 + H * 0.25)}" fill="#37474F"/><rect x="${cx + d * 0.08}" y="${top + d * 0.8 + H * 0.25}" width="${d * 0.22}" height="${H * 0.93 - (top + d * 0.8 + H * 0.25)}" fill="#37474F"/><rect x="${cx + d * 0.3}" y="${top + d * 0.9}" width="${d * 0.28}" height="${H * 0.16}" rx="10" fill="#FFCA28"/>`;
    items.push({ buf: f, x: cx - d / 2, y: top, w: d, h: d, circle: true, ring: "#fff", ringW: 6 });
  });
  return compose(name, W, H, ground, items);
}
