// Word puzzles for workbook activities (src/lib/activities.ts): crossword,
// word search and scrambled words. The grids are built here, from the
// block's answers, never by the model - a model-drawn grid is never
// consistent. Deterministic (seeded by the block heading), so every render
// and export of a book shows the same puzzle.
//
// Pure TS, shared by the PDF, the web reader, EPUB and the fit estimate.

export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The letters of an answer as they go into a grid: upper case, letters only
// ("ice-cream" -> "ICECREAM"). Locale-aware so Turkish i/ı survive.
export function puzzleLetters(answer: string, locale = "en"): string[] {
  return [...answer.toLocaleUpperCase(locale)].filter((c) => /\p{L}/u.test(c));
}

// ---- Crossword ----

export type CrosswordWord = { item: number; row: number; col: number; dir: "across" | "down"; letters: string[] };
export type Crossword = { rows: number; cols: number; words: CrosswordWord[]; unplaced: number[] };

const MAX_CROSSWORD = 15;

// Greedy placement depends on the order words are tried in, so several
// orders are tried (longest-first, then seeded shuffles) and the grid that
// places the most words - then the most compact one - wins.
export function buildCrossword(answers: string[], locale = "en"): Crossword {
  const entries = answers.map((a, item) => ({ item, letters: puzzleLetters(a, locale) })).filter((e) => e.letters.length >= 2);
  // No usable word (empty key, one-letter answers): an empty grid, never a
  // crash - live run 2026-10-13 lost a whole unit to one bad crossword.
  if (!entries.length) return { rows: 0, cols: 0, words: [], unplaced: answers.map((_, i) => i) };
  const longestFirst = [...entries].sort((a, b) => b.letters.length - a.letters.length || a.item - b.item);
  const rand = seededRandom(answers.join("|"));
  const orders = [longestFirst];
  for (let i = 0; i < 24; i++) {
    const [first, ...rest] = longestFirst;
    const shuffled = [...rest];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    // vary the anchor word too
    orders.push(i % 2 ? [first, ...shuffled] : [...shuffled, first]);
  }
  let best: Crossword | null = null;
  for (const order of orders) {
    const cw = placeCrossword(order, answers.length);
    if (!best || cw.unplaced.length < best.unplaced.length || (cw.unplaced.length === best.unplaced.length && cw.rows * cw.cols < best.rows * best.cols)) best = cw;
  }
  return best!;
}

function placeCrossword(entries: { item: number; letters: string[] }[], answerCount: number): Crossword {
  const cells = new Map<string, string>();
  const at = (r: number, c: number) => cells.get(`${r},${c}`);
  const placed: CrosswordWord[] = [];
  const bounds = () => {
    const rs = [...cells.keys()].map((k) => Number(k.split(",")[0]));
    const cs = [...cells.keys()].map((k) => Number(k.split(",")[1]));
    return { r0: Math.min(...rs), r1: Math.max(...rs), c0: Math.min(...cs), c1: Math.max(...cs) };
  };
  const put = (w: CrosswordWord) => {
    w.letters.forEach((l, i) => cells.set(w.dir === "across" ? `${w.row},${w.col + i}` : `${w.row + i},${w.col}`, l));
    placed.push(w);
  };

  // How many letters a placement shares with the grid, or -1 if it breaks
  // the grid (wrong letter, touching another word side-on, running on).
  const crossings = (letters: string[], row: number, col: number, dir: "across" | "down"): number => {
    const dr = dir === "down" ? 1 : 0;
    const dc = dir === "across" ? 1 : 0;
    if (at(row - dr, col - dc) || at(row + dr * letters.length, col + dc * letters.length)) return -1;
    let shared = 0;
    for (let i = 0; i < letters.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      const existing = at(r, c);
      if (existing) {
        if (existing !== letters[i]) return -1;
        shared++;
      } else if (at(r + dc, c + dr) || at(r - dc, c - dr)) {
        return -1;
      }
    }
    return shared;
  };

  const unplaced: number[] = [];
  let queue = [...entries];
  for (let pass = 0; pass < 2 && queue.length; pass++) {
    const left: typeof queue = [];
    for (const e of queue) {
      if (!placed.length) {
        put({ item: e.item, row: 0, col: 0, dir: "across", letters: e.letters });
        continue;
      }
      let best: { w: CrosswordWord; score: number } | null = null;
      for (const p of placed) {
        p.letters.forEach((pl, pi) => {
          e.letters.forEach((el, ei) => {
            if (pl !== el) return;
            const dir = p.dir === "across" ? "down" : "across";
            const row = p.dir === "across" ? p.row - ei : p.row + pi;
            const col = p.dir === "across" ? p.col + pi : p.col - ei;
            const shared = crossings(e.letters, row, col, dir);
            if (shared < 1) return;
            const b = bounds();
            const r1 = Math.max(b.r1, dir === "down" ? row + e.letters.length - 1 : row);
            const c1 = Math.max(b.c1, dir === "across" ? col + e.letters.length - 1 : col);
            const height = r1 - Math.min(b.r0, row) + 1;
            const width = c1 - Math.min(b.c0, col) + 1;
            if (height > MAX_CROSSWORD || width > MAX_CROSSWORD) return;
            const score = shared * 1000 - height * width;
            if (!best || score > best.score) best = { w: { item: e.item, row, col, dir, letters: e.letters }, score };
          });
        });
      }
      if (best) put((best as { w: CrosswordWord }).w);
      else left.push(e);
    }
    queue = left;
  }
  unplaced.push(...queue.map((e) => e.item), ...Array.from({ length: answerCount }, (_, i) => i).filter((i) => !entries.some((e) => e.item === i)));

  if (!placed.length) return { rows: 0, cols: 0, words: [], unplaced: unplaced.sort((a, b) => a - b) };
  const b = bounds();
  return {
    rows: b.r1 - b.r0 + 1,
    cols: b.c1 - b.c0 + 1,
    words: placed.map((w) => ({ ...w, row: w.row - b.r0, col: w.col - b.c0 })).sort((x, y) => x.item - y.item),
    unplaced: unplaced.sort((a, b2) => a - b2),
  };
}

// The grid as rows of cells: null = no square, otherwise the clue numbers
// (item index + 1) that start in it.
export function crosswordCells(cw: Crossword): ({ starts: number[] } | null)[][] {
  const grid: ({ starts: number[] } | null)[][] = Array.from({ length: cw.rows }, () => Array.from({ length: cw.cols }, () => null));
  for (const w of cw.words) {
    w.letters.forEach((_, i) => {
      const r = w.dir === "down" ? w.row + i : w.row;
      const c = w.dir === "across" ? w.col + i : w.col;
      grid[r][c] ??= { starts: [] };
    });
    grid[w.row][w.col]!.starts.push(w.item + 1);
  }
  return grid;
}

// ---- Word search ----

export type WordSearch = { size: number; grid: string[][]; unplaced: number[] };

export function buildWordSearch(words: string[], seed: string, locale = "en"): WordSearch {
  const rand = seededRandom(seed);
  const entries = words.map((w, item) => ({ item, letters: puzzleLetters(w, locale) })).filter((e) => e.letters.length >= 2);
  const longest = Math.max(0, ...entries.map((e) => e.letters.length));
  const letterCount = entries.reduce((n, e) => n + e.letters.length, 0);
  const size = Math.min(12, Math.max(8, longest, Math.ceil(Math.sqrt(letterCount * 2.2))));
  const grid: (string | null)[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => null));
  const unplaced: number[] = words.map((_, i) => i).filter((i) => !entries.some((e) => e.item === i));

  for (const e of [...entries].sort((a, b) => b.letters.length - a.letters.length)) {
    let done = false;
    for (let tries = 0; tries < 300 && !done; tries++) {
      const down = rand() < 0.5;
      if (e.letters.length > size) break;
      const row = Math.floor(rand() * (down ? size - e.letters.length + 1 : size));
      const col = Math.floor(rand() * (down ? size : size - e.letters.length + 1));
      const fits = e.letters.every((l, i) => {
        const cell = grid[down ? row + i : row][down ? col : col + i];
        return cell === null || cell === l;
      });
      if (!fits) continue;
      e.letters.forEach((l, i) => (grid[down ? row + i : row][down ? col : col + i] = l));
      done = true;
    }
    if (!done) unplaced.push(e.item);
  }

  const alphabet = [...new Set(entries.flatMap((e) => e.letters))];
  const filler = alphabet.length >= 6 ? alphabet : [..."ABCDEFGHIJKLMNOPRSTUVWYZ"];
  return {
    size,
    grid: grid.map((row) => row.map((cell) => cell ?? filler[Math.floor(rand() * filler.length)])),
    unplaced: unplaced.sort((a, b) => a - b),
  };
}

// ---- Scrambled word ----

// The answer's letters in a mixed order that never spells the answer.
export function scrambleWord(answer: string, seed: string, locale = "en"): string {
  const letters = puzzleLetters(answer, locale).map((l) => l.toLocaleLowerCase(locale));
  if (letters.length < 2 || new Set(letters).size < 2) return letters.join("");
  const rand = seededRandom(seed + answer);
  let out = letters;
  for (let tries = 0; tries < 10 && out.join("") === letters.join(""); tries++) {
    out = [...letters];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
  }
  if (out.join("") === letters.join("")) out = [...letters.slice(1), letters[0]];
  return out.join("");
}

// "cat / dog / apple / bird" -> ["cat", "dog", "apple", "bird"]
export function oddOneOutOptions(item: string): string[] {
  return item
    .split(/\s*[\/|,]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// A tick/cross answer read leniently: ✓ / true / yes / T -> true.
export function tickAnswer(answer: string): boolean | null {
  const a = answer.trim().toLowerCase();
  if (/^(✓|✔|true|yes|t|y|correct|right|doğru)$/.test(a)) return true;
  if (/^(✗|✘|x|false|no|f|n|wrong|incorrect|yanlış)$/.test(a)) return false;
  return null;
}
