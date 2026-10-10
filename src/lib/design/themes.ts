// Faz 1 "Tasarım sistemi": visual themes (design tokens). One theme is
// chosen per run (generation_runs.design_theme) and drives the PDF
// (BookDocument.tsx), the web reader and the Dizilim preview
// (PageContent.tsx). Pure TS - safe for client components.
//
// Fonts are limited to the two families BookDocument registers (Noto Sans,
// Noto Serif) because both carry full Turkish glyph coverage in one file -
// see src/lib/pdf/fonts.ts for why subsetted web fonts break ı/ş/ğ.

export type BookVariantId = "student_book" | "workbook" | "teacher_book" | "test_booklet";

export type ThemePalette = { primary: string; primaryDark: string; primaryLight: string; accent: string };

export type DesignThemeId = "classic" | "modern-elt" | "playful-kids" | "academic" | "storybook";

// Typeface roles a theme can pick. Every family behind them is OFL and
// covers Turkish (checked glyph by glyph before it was added - Fredoka was
// rejected for missing ı/ş/ğ): sans/serif = Noto, rounded = Baloo 2
// (display headings), reading = Andika (SIL's typeface for early readers:
// single-storey a and g), friendly = Nunito.
export type FontRole = "sans" | "serif" | "rounded" | "reading" | "friendly";

export type DesignTheme = {
  id: DesignThemeId;
  label: string;
  description: string;
  headingFont: FontRole;
  bodyFont: FontRole;
  /** Body text size in pt (PDF) - younger audiences get larger type. */
  bodySize: number;
  /** Corner radius in pt for cards, boxes and images. */
  radius: number;
  /** How content blocks are framed. */
  cardStyle: "accent-bar" | "tinted" | "outlined";
  /** Front cover composition. */
  coverStyle: "band" | "full-bleed" | "framed";
  palettes: Record<BookVariantId, ThemePalette>;
};

export const DESIGN_THEMES: Record<DesignThemeId, DesignTheme> = {
  // The look every book had before themes existed - kept byte-for-byte as
  // the default so older runs re-assemble unchanged.
  classic: {
    id: "classic",
    label: "Klasik",
    description: "Sade, okunaklı; renkli bant kapak ve sol çizgili bloklar.",
    headingFont: "sans",
    bodyFont: "serif",
    bodySize: 10.5,
    radius: 6,
    cardStyle: "accent-bar",
    coverStyle: "band",
    palettes: {
      student_book: { primary: "#2563eb", primaryDark: "#1e3a8a", primaryLight: "#eff6ff", accent: "#f59e0b" },
      workbook: { primary: "#0d9488", primaryDark: "#115e59", primaryLight: "#f0fdfa", accent: "#f97316" },
      teacher_book: { primary: "#7c3aed", primaryDark: "#4c1d95", primaryLight: "#f5f3ff", accent: "#f59e0b" },
      test_booklet: { primary: "#dc2626", primaryDark: "#7f1d1d", primaryLight: "#fef2f2", accent: "#f59e0b" },
    },
  },
  "modern-elt": {
    id: "modern-elt",
    label: "Modern ELT",
    description: "Yayınevi ders kitabı havası: tam sayfa kapak görseli, renkli kutular, iki sütunlu düzen.",
    headingFont: "friendly",
    bodyFont: "sans",
    bodySize: 10,
    radius: 10,
    cardStyle: "tinted",
    coverStyle: "full-bleed",
    palettes: {
      student_book: { primary: "#e11d48", primaryDark: "#881337", primaryLight: "#fff1f2", accent: "#0ea5e9" },
      workbook: { primary: "#0284c7", primaryDark: "#0c4a6e", primaryLight: "#f0f9ff", accent: "#f59e0b" },
      teacher_book: { primary: "#4f46e5", primaryDark: "#312e81", primaryLight: "#eef2ff", accent: "#f43f5e" },
      test_booklet: { primary: "#059669", primaryDark: "#064e3b", primaryLight: "#ecfdf5", accent: "#f59e0b" },
    },
  },
  "playful-kids": {
    id: "playful-kids",
    label: "Çocuk / Eğlenceli",
    description: "Büyük punto, yuvarlak köşeler, canlı renkler; ilkokul seviyesi için.",
    headingFont: "rounded",
    bodyFont: "reading",
    bodySize: 12.5,
    radius: 16,
    cardStyle: "tinted",
    coverStyle: "full-bleed",
    palettes: {
      student_book: { primary: "#f97316", primaryDark: "#9a3412", primaryLight: "#fff7ed", accent: "#22c55e" },
      workbook: { primary: "#8b5cf6", primaryDark: "#5b21b6", primaryLight: "#f5f3ff", accent: "#facc15" },
      teacher_book: { primary: "#0ea5e9", primaryDark: "#075985", primaryLight: "#f0f9ff", accent: "#f97316" },
      test_booklet: { primary: "#ec4899", primaryDark: "#9d174d", primaryLight: "#fdf2f8", accent: "#22c55e" },
    },
  },
  academic: {
    id: "academic",
    label: "Akademik",
    description: "Serif başlıklar, ince çerçeveler, sakin lacivert/bordo; lise ve yetişkin seviyesi.",
    headingFont: "serif",
    bodyFont: "serif",
    bodySize: 10,
    radius: 2,
    cardStyle: "outlined",
    coverStyle: "framed",
    palettes: {
      student_book: { primary: "#1e3a5f", primaryDark: "#0f1f33", primaryLight: "#f1f5f9", accent: "#9f1239" },
      workbook: { primary: "#14532d", primaryDark: "#052e16", primaryLight: "#f0fdf4", accent: "#a16207" },
      teacher_book: { primary: "#581c87", primaryDark: "#2e1065", primaryLight: "#faf5ff", accent: "#a16207" },
      test_booklet: { primary: "#7f1d1d", primaryDark: "#450a0a", primaryLight: "#fef2f2", accent: "#1e3a5f" },
    },
  },
  storybook: {
    id: "storybook",
    label: "Hikâye Kitabı",
    description: "Sıcak toprak tonları, serif metin, tam sayfa illüstrasyonlar.",
    headingFont: "serif",
    bodyFont: "serif",
    bodySize: 13,
    radius: 12,
    cardStyle: "tinted",
    coverStyle: "full-bleed",
    palettes: {
      student_book: { primary: "#b45309", primaryDark: "#78350f", primaryLight: "#fffbeb", accent: "#15803d" },
      workbook: { primary: "#15803d", primaryDark: "#14532d", primaryLight: "#f0fdf4", accent: "#b45309" },
      teacher_book: { primary: "#9333ea", primaryDark: "#581c87", primaryLight: "#faf5ff", accent: "#b45309" },
      test_booklet: { primary: "#be123c", primaryDark: "#881337", primaryLight: "#fff1f2", accent: "#b45309" },
    },
  },
};

export const DESIGN_THEME_IDS = Object.keys(DESIGN_THEMES) as DesignThemeId[];
export const DEFAULT_DESIGN_THEME: DesignThemeId = "classic";

export function isDesignThemeId(value: unknown): value is DesignThemeId {
  return typeof value === "string" && value in DESIGN_THEMES;
}

export function resolveDesignTheme(id: string | null | undefined): DesignTheme {
  return (id && DESIGN_THEMES[id as DesignThemeId]) || DESIGN_THEMES[DEFAULT_DESIGN_THEME];
}

// Callout boxes (tip / did_you_know / remember) - fixed semantic colours,
// independent of the theme palette so a "Remember" box reads the same in
// every book.
export const CALLOUT_STYLES = {
  tip: { label: "TIP", bg: "#ecfdf5", border: "#10b981", text: "#065f46" },
  did_you_know: { label: "DID YOU KNOW?", bg: "#eff6ff", border: "#3b82f6", text: "#1e40af" },
  remember: { label: "REMEMBER", bg: "#fffbeb", border: "#f59e0b", text: "#92400e" },
  grammar: { label: "GRAMMAR", bg: "#f5f3ff", border: "#8b5cf6", text: "#5b21b6" },
} as const;
export type CalloutKind = keyof typeof CALLOUT_STYLES;

// Speech-bubble colours, cycled by speaker order of first appearance.
export const SPEAKER_COLORS = ["#2563eb", "#db2777", "#059669", "#d97706", "#7c3aed"];

export function speakerColorMap(lines: { speaker: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const l of lines) {
    if (!map.has(l.speaker)) map.set(l.speaker, SPEAKER_COLORS[map.size % SPEAKER_COLORS.length]);
  }
  return map;
}
