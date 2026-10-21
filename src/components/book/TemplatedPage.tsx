"use client";

import type { CSSProperties, ReactNode } from "react";
import type { ContentBlock, GeneratedPage, ListeningAudio } from "@/lib/ai/schemas";
import { PAGE_WIDTH_PT, PAGE_HEIGHT_PT, PAGE_PADDING } from "@/lib/pdf/page-geometry";
import { DENSE_LINE, MAX_PICTURE_ASPECT, ZONE_GAP, isExerciseBlock, panelledExercises, planZones, type DesignedTemplate } from "@/lib/design/layouts";
import { stripExerciseNumber } from "@/lib/exercise-numbers";
import type { DesignTheme, FontRole, ThemePalette } from "@/lib/design/themes";
import type { PageFurniture } from "@/lib/design/page-furniture";

// Faz 1 "Tasarım sistemi": web twin of src/lib/pdf/templates.tsx. Draws a
// templated page on an A4-proportioned sheet (pt used directly as CSS px,
// the same convention PositionedPage uses) so the reader, the Dizilim
// flip-book and the printed PDF show the same arrangement. Blocks keep
// their interactive exercises - they're rendered by the BlockView passed in.

/** furniture: the source's page furniture (page-furniture.ts) - exercise numbers on discs, as in the PDF. */
export type WebLook = { theme: DesignTheme; palette: ThemePalette; furniture?: PageFurniture | null };

export type RenderBlock = (block: ContentBlock, opts: { frameless?: boolean; dense?: boolean; panel?: boolean }) => ReactNode;

const SERIF = 'ui-serif, Georgia, "Noto Serif", serif';
const SANS = 'ui-sans-serif, system-ui, "Noto Sans", sans-serif';

// Same typefaces as the PDF (src/lib/pdf/fonts.ts), served from
// public/fonts via the @font-face rules in globals.css.
const ROLE_STACK: Record<FontRole, string> = {
  sans: SANS,
  serif: SERIF,
  rounded: `"Baloo 2", ${SANS}`,
  reading: `Andika, ${SANS}`,
  friendly: `Nunito, ${SANS}`,
};

export function lookFonts(look: WebLook) {
  return {
    heading: ROLE_STACK[look.theme.headingFont] ?? SANS,
    body: ROLE_STACK[look.theme.bodyFont] ?? SANS,
  };
}

function Illustration({ src, height, look, style }: { src: string; height: number; look: WebLook; style?: CSSProperties }) {
  return (
    <div
      className="mb-3 overflow-hidden"
      style={{ height, borderRadius: look.theme.radius, background: look.palette.primaryLight, ...style }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- externally-hosted (Vercel Blob) generated image */}
      <img src={src} alt="" className="h-full w-full object-cover" />
    </div>
  );
}

function UnitHeading({ unit, look }: { unit: { unitNumber: number; title: string }; look: WebLook }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span
        className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ background: look.palette.primary }}
      >
        {unit.unitNumber}
      </span>
      <div>
        <div className="text-[8.5px] font-bold tracking-[0.15em]" style={{ color: look.palette.primary }}>
          UNIT {unit.unitNumber}
        </div>
        <div className="text-lg font-bold" style={{ fontFamily: lookFonts(look).heading }}>
          {unit.title}
        </div>
      </div>
    </div>
  );
}

function SectionKicker({ text, look }: { text?: string; look: WebLook }) {
  if (!text) return null;
  return (
    <span
      className="mb-2 inline-block px-2 py-0.5 text-[8px] font-bold tracking-[0.15em] text-white uppercase"
      style={{ background: look.palette.primary, borderRadius: look.theme.radius }}
    >
      {text}
    </span>
  );
}

export function splitColumnsWeb(blocks: ContentBlock[]): [ContentBlock[], ContentBlock[]] {
  const weight = (b: ContentBlock) =>
    b.body.length + (b.items ?? []).join(" ").length + (b.dialogue ?? []).reduce((n, d) => n + d.line.length + 20, 0) + 120;
  const total = blocks.reduce((n, b) => n + weight(b), 0);
  const left: ContentBlock[] = [];
  const right: ContentBlock[] = [];
  let acc = 0;
  for (const b of blocks) {
    if (acc < total / 2) {
      left.push(b);
      acc += weight(b);
    } else right.push(b);
  }
  return [left, right];
}

export function TemplatedPage({
  template,
  page,
  unit,
  isUnitFirstPage,
  imageUrl,
  imageUrls,
  look,
  renderBlock,
}: {
  template: DesignedTemplate;
  page: GeneratedPage;
  unit: { unitNumber: number; title: string };
  isUnitFirstPage: boolean;
  imageUrl?: string;
  /** Faz B3: every picture of the page, main picture first (source-zones). */
  imageUrls?: string[];
  look: WebLook;
  renderBlock: RenderBlock;
  listeningAudio?: ListeningAudio[];
}) {
  const fonts = lookFonts(look);
  const H = PAGE_HEIGHT_PT;
  // KIYAS-11: every second exercise on a mirrored page sits on the book's tint (panelledExercises)
  const panels = panelledExercises(page.blocks);
  const blocks = (list: ContentBlock[], frameless?: boolean, dense?: boolean) =>
    list.map((b, i) => <div key={i}>{renderBlock(b, { frameless, dense, panel: dense && panels.has(b) })}</div>);
  const heading = isUnitFirstPage && template !== "unit-opener-hero" && template !== "full-bleed-illustration" ? <UnitHeading unit={unit} look={look} /> : null;
  const kicker = <SectionKicker text={page.sectionLabel} look={look} />;
  const glossaryCards = (columns: 2 | 3) =>
    page.glossary?.length ? (
      <div className={columns === 3 ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-2"}>
        {page.glossary.map((g, i) => (
          <div
            key={i}
            className="border p-2 text-[11px]"
            style={{ borderColor: look.palette.primary, background: look.palette.primaryLight, borderRadius: look.theme.radius }}
          >
            <div className="font-bold" style={{ color: look.palette.primaryDark }}>
              {g.term}
            </div>
            <div>{g.definition}</div>
            {g.example && <div className="italic text-gray-600">e.g. {g.example}</div>}
          </div>
        ))}
      </div>
    ) : null;

  let body: ReactNode;
  switch (template) {
    case "source-zones": {
      // Web twin of the PDF's source-zones (src/lib/pdf/templates.tsx) -
      // same plan, same block distribution.
      const pictures = imageUrls ?? (imageUrl ? [imageUrl] : []);
      const { bands, pictureScale, textScale } = planZones(page, pictures.length, !!heading, {
        width: PAGE_WIDTH_PT,
        height: H,
        bodySize: look.theme.bodySize,
      });
      const pictureHeight = (h: number) => Math.round(h * H * pictureScale);
      body = (
        <>
          {heading}
          {kicker}
          <div style={{ fontSize: look.theme.bodySize * textScale, lineHeight: DENSE_LINE }}>
          {bands.map((band, i) => {
            if (band.kind === "pictures") {
              const h = pictureHeight(band.height);
              return (
                <div
                  key={i}
                  className="flex"
                  style={{ gap: ZONE_GAP, marginBottom: ZONE_GAP, marginLeft: `${(band.left ?? 0) * 100}%`, width: `${(band.span ?? 1) * 100}%` }}
                >
                  {band.pictures.map((p, k) => (
                    <div key={k} className="flex min-w-0 justify-center" style={{ flex: band.widths[k] }}>
                      <div style={{ width: `${pictureScale * 100}%`, maxWidth: h * MAX_PICTURE_ASPECT }}>
                        <Illustration src={pictures[p]} height={h} look={look} style={{ marginBottom: 0 }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            if (band.kind === "split") {
              const h = pictureHeight(band.height);
              const each = Math.round((h - ZONE_GAP * (band.pictures.length - 1)) / band.pictures.length);
              const imageColumn = (
                <div className="flex shrink-0 flex-col" style={{ width: `${band.imageWidth * pictureScale * 100}%`, gap: ZONE_GAP }}>
                  {band.pictures.map((p, k) => (
                    <Illustration key={k} src={pictures[p]} height={each} look={look} style={{ marginBottom: 0 }} />
                  ))}
                </div>
              );
              return (
                <div key={i} className="flex" style={{ gap: ZONE_GAP, marginBottom: ZONE_GAP }}>
                  {band.side === "left" && imageColumn}
                  <div className="min-w-0 flex-1">{blocks(band.blocks, true, true)}</div>
                  {band.side === "right" && imageColumn}
                </div>
              );
            }
            if (band.kind === "columns") {
              return (
                <div key={i} className="grid grid-cols-2 gap-4" style={{ marginBottom: ZONE_GAP }}>
                  {band.columns.map((items, c) => (
                    <div key={c} className="flex min-w-0 flex-col" style={{ gap: ZONE_GAP }}>
                      {items.map((item, k) =>
                        item.kind === "picture" ? (
                          <div key={k} className="self-center" style={{ width: `${pictureScale * 100}%` }}>
                            <Illustration src={pictures[item.picture]} height={pictureHeight(item.height)} look={look} style={{ marginBottom: 0 }} />
                          </div>
                        ) : (
                          <div key={k}>{blocks(item.blocks, true, true)}</div>
                        ),
                      )}
                    </div>
                  ))}
                </div>
              );
            }
            if (band.columns === 2) {
              const [left, right] = splitColumnsWeb(band.blocks);
              return (
                <div key={i} className="grid grid-cols-2 gap-4" style={{ marginBottom: ZONE_GAP }}>
                  <div>{blocks(left, true, true)}</div>
                  <div>{blocks(right, true, true)}</div>
                </div>
              );
            }
            return (
              <div key={i} style={{ marginBottom: ZONE_GAP }}>
                {blocks(band.blocks, true, true)}
              </div>
            );
          })}
          </div>
          {glossaryCards(3)}
        </>
      );
      break;
    }
    case "unit-opener-hero": {
      const hero = Math.round(H * 0.42);
      body = (
        <>
          {imageUrl && (
            <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: hero }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- externally-hosted generated image */}
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="relative" style={{ marginTop: hero - PAGE_PADDING.top - 30 }}>
            <div className="mb-4 inline-block px-4 py-2.5 text-white" style={{ background: look.palette.primary, borderRadius: look.theme.radius }}>
              <div className="text-[9px] font-bold tracking-[0.2em] opacity-85">UNIT {unit.unitNumber}</div>
              <div className="text-2xl font-bold" style={{ fontFamily: fonts.heading }}>
                {unit.title}
              </div>
            </div>
          </div>
          {kicker}
          {blocks(page.blocks)}
          {glossaryCards(3)}
        </>
      );
      break;
    }
    case "full-bleed-illustration":
      body = (
        <>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- externally-hosted generated image
            <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div
            className="absolute inset-x-8 bottom-10 bg-white/90 p-4"
            style={{ borderRadius: Math.max(10, look.theme.radius), fontSize: look.theme.bodySize + 2 }}
          >
            {page.blocks.map((b, i) => (
              <div key={i}>
                {b.heading && (
                  <div className="mb-1 font-bold" style={{ color: look.palette.primaryDark, fontFamily: fonts.heading }}>
                    {b.heading}
                  </div>
                )}
                <p className="leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </>
      );
      break;
    case "two-column": {
      const [left, right] = splitColumnsWeb(page.blocks);
      body = (
        <>
          {heading}
          {kicker}
          {imageUrl && <Illustration src={imageUrl} height={Math.round(H * 0.26)} look={look} />}
          <div className="grid grid-cols-2 gap-4">
            <div>{blocks(left)}</div>
            <div>{blocks(right)}</div>
          </div>
          {glossaryCards(2)}
        </>
      );
      break;
    }
    case "image-left-text-right":
      body = (
        <>
          {heading}
          {kicker}
          <div className="flex gap-4">
            <div style={{ width: "44%" }} className="shrink-0">
              {imageUrl && <Illustration src={imageUrl} height={Math.round((PAGE_WIDTH_PT - 88) * 0.44 * 1.15)} look={look} />}
              {blocks(page.blocks.filter((b) => b.callout))}
            </div>
            <div className="min-w-0 flex-1">{blocks(page.blocks.filter((b) => !b.callout))}</div>
          </div>
          {glossaryCards(2)}
        </>
      );
      break;
    case "dialogue-strip":
      body = (
        <>
          {heading}
          {kicker}
          {imageUrl && <Illustration src={imageUrl} height={Math.round(H * 0.24)} look={look} />}
          {page.blocks.map((b, i) => (
            <div key={i}>{renderBlock(b, { frameless: !!b.dialogue?.length })}</div>
          ))}
          {glossaryCards(2)}
        </>
      );
      break;
    case "exercise-grid": {
      const exercises = page.blocks.filter(isExerciseBlock);
      body = (
        <>
          {heading}
          {kicker}
          {imageUrl && <Illustration src={imageUrl} height={Math.round(H * 0.2)} look={look} />}
          {blocks(page.blocks.filter((b) => !isExerciseBlock(b)))}
          <div className={exercises.length === 1 ? "grid gap-3" : "grid grid-cols-2 gap-3"}>
            {exercises.map((b, i) => (
              <div key={i} className="relative mt-2 border p-2.5 pt-3.5" style={{ borderColor: look.palette.primary, borderRadius: look.theme.radius }}>
                <span
                  className="absolute -top-2.5 left-2.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: look.palette.accent }}
                >
                  {i + 1}
                </span>
                {renderBlock({ ...b, heading: stripExerciseNumber(b.heading) }, { frameless: true })}
              </div>
            ))}
          </div>
          {glossaryCards(2)}
        </>
      );
      break;
    }
    case "vocab-cards":
      body = (
        <>
          {heading}
          {kicker}
          {imageUrl && <Illustration src={imageUrl} height={Math.round(H * 0.2)} look={look} />}
          {glossaryCards(3)}
          <div className="h-2.5" />
          {blocks(page.blocks)}
        </>
      );
      break;
    case "reading-with-sidebar": {
      const isSide = (b: ContentBlock) => !!b.callout || isExerciseBlock(b);
      body = (
        <>
          {heading}
          {kicker}
          <div className="flex gap-3.5">
            <div style={{ flex: 1.8 }} className="min-w-0">
              {imageUrl && <Illustration src={imageUrl} height={Math.round(H * 0.22)} look={look} />}
              {blocks(page.blocks.filter((b) => !isSide(b)), true)}
            </div>
            <div className="min-w-0 p-2.5" style={{ flex: 1, background: look.palette.primaryLight, borderRadius: look.theme.radius }}>
              {blocks(page.blocks.filter(isSide), true)}
              {page.glossary?.map((g, i) => (
                <p key={i} className="mb-1 text-[10px]">
                  <b style={{ color: look.palette.primaryDark }}>{g.term}</b> – {g.definition}
                </p>
              ))}
            </div>
          </div>
        </>
      );
      break;
    }
    case "review-checklist":
      body = (
        <>
          {heading}
          {kicker}
          {blocks(page.blocks)}
          {glossaryCards(2)}
        </>
      );
      break;
  }

  return (
    <div className="mb-6">
      <div
        className="relative mx-auto overflow-hidden rounded-lg border border-border bg-white text-gray-800 shadow-sm"
        style={{
          width: PAGE_WIDTH_PT,
          minHeight: PAGE_HEIGHT_PT,
          paddingTop: PAGE_PADDING.top,
          paddingLeft: PAGE_PADDING.left,
          paddingRight: PAGE_PADDING.right,
          paddingBottom: PAGE_PADDING.bottom,
          fontFamily: fonts.body,
          fontSize: look.theme.bodySize + 1,
        }}
      >
        {template !== "unit-opener-hero" && template !== "full-bleed-illustration" && (
          <div className="mb-2.5 text-[7.5px] font-bold tracking-[0.12em] uppercase" style={{ color: look.palette.primary }}>
            Unit {unit.unitNumber} · {unit.title}
          </div>
        )}
        {body}
      </div>
    </div>
  );
}
