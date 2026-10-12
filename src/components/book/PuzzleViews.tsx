"use client";

import type { ContentBlock } from "@/lib/ai/schemas";
import { letterFor } from "@/lib/activities";
import { seededShuffle } from "@/lib/content-html";
import { itemText } from "@/lib/item-text";
import { buildCrossword, buildWordSearch, crosswordCells, oddOneOutOptions, scrambleWord } from "@/lib/puzzles";

// Faz B4: screen twins of src/lib/pdf/puzzle-blocks.tsx - same grids (built
// by src/lib/puzzles.ts), same scrambles and column order.

const box = (primary: string) => (
  <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-[3px] border-[1.5px] bg-white" style={{ borderColor: primary }} />
);

export function PuzzleView({ block, primary }: { block: ContentBlock; primary: string }) {
  const type = block.activity?.type;
  const items = block.items ?? [];
  const answers = block.answerKey ?? [];

  if (type === "crossword") {
    const cw = buildCrossword(answers);
    const cells = crosswordCells(cw);
    return (
      <div className="mt-2">
        <div className="mx-auto mb-3 grid w-fit" style={{ gridTemplateColumns: `repeat(${cw.cols}, 1.4rem)` }}>
          {cells.flat().map((c, i) =>
            c ? (
              <div key={i} className="relative h-[1.4rem] w-[1.4rem] border border-gray-700 bg-white">
                {c.starts.length > 0 && <span className="absolute top-0 left-0.5 text-[7px] leading-none">{c.starts.join("/")}</span>}
              </div>
            ) : (
              <div key={i} className="h-[1.4rem] w-[1.4rem]" />
            ),
          )}
        </div>
        {(["across", "down"] as const).map((dir) => {
          const words = cw.words.filter((w) => w.dir === dir);
          return words.length ? (
            <div key={dir} className="mb-2 text-sm">
              <div className="text-xs font-bold" style={{ color: primary }}>
                {dir === "across" ? "Across" : "Down"}
              </div>
              {words.map((w) => (
                <div key={w.item}>
                  <span className="mr-2 font-bold" style={{ color: primary }}>
                    {w.item + 1}
                  </span>
                  {itemText(items[w.item] ?? "")}
                </div>
              ))}
            </div>
          ) : null;
        })}
      </div>
    );
  }

  if (type === "wordsearch") {
    const words = answers.length ? answers : items;
    const ws = buildWordSearch(words, block.heading);
    return (
      <div className="mt-2 flex flex-wrap items-start gap-4">
        <div className="grid rounded-md border bg-white p-1 font-mono text-sm font-bold" style={{ gridTemplateColumns: `repeat(${ws.size}, 1.3rem)`, borderColor: primary }}>
          {ws.grid.flat().map((l, i) => (
            <span key={i} className="flex h-[1.3rem] items-center justify-center">
              {l}
            </span>
          ))}
        </div>
        <ul className="flex flex-col gap-1 text-sm">
          {words.map((w, i) => (
            <li key={i} className="flex items-center gap-2">
              {box(primary)}
              {w}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (type === "match_lines") {
    const right = seededShuffle(answers, block.heading);
    return (
      <div className="mt-2 flex flex-col gap-2 text-sm">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="font-bold" style={{ color: primary }}>
              {i + 1}
            </span>
            <span className="flex-1">{itemText(item)}</span>
            <span className="h-2 w-2 rounded-full" style={{ background: primary }} />
            <span className="w-8" />
            <span className="h-2 w-2 rounded-full" style={{ background: primary }} />
            <span className="font-bold" style={{ color: primary }}>
              {letterFor(i)}
            </span>
            <span className="flex-1">{right[i] ? itemText(right[i]) : ""}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2 text-sm">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          {type === "ordering" ? (
            box(primary)
          ) : (
            <span className="font-bold" style={{ color: primary }}>
              {i + 1}
            </span>
          )}
          {type === "unscramble" ? (
            <span className="flex flex-1 flex-col">
              <span className="flex items-end gap-2">
                <span className="font-bold tracking-[0.2em]" style={{ color: primary }}>
                  {scrambleWord(answers[i] ?? "", block.heading)}
                </span>
                <span className="mb-1 h-0 w-28 border-b border-gray-400" />
              </span>
              {itemText(item) && <span className="text-xs text-gray-500">{itemText(item)}</span>}
            </span>
          ) : type === "odd_one_out" ? (
            <span className="flex flex-1 flex-wrap gap-x-5">
              {oddOneOutOptions(item).map((o, k) => (
                <span key={k}>{o}</span>
              ))}
            </span>
          ) : (
            <span className="flex-1">{itemText(item)}</span>
          )}
          {type === "tick_cross" && box(primary)}
        </div>
      ))}
    </div>
  );
}

export const PUZZLE_TYPES = new Set(["crossword", "wordsearch", "unscramble", "odd_one_out", "tick_cross", "ordering", "match_lines"]);
