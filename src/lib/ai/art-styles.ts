// Faz 2 "İllüstrasyon stili": one art direction per book, chosen at project
// creation (generation_runs.art_style). Every image the pipeline generates
// - character sheets, cover, page illustrations - ends with the same style
// sentence, which is what makes a book's pictures look like they were drawn
// by one illustrator instead of five. Pure data - safe for client imports.

export type ArtStyleId = "textbook" | "3d-render" | "flat-vector" | "watercolor" | "pencil-storybook" | "photo-realistic";

export type ArtStyle = {
  id: ArtStyleId;
  label: string;
  description: string;
  /** Appended to every image prompt. */
  prompt: string;
  /** CSS gradient for the picker swatch (no sample images shipped). */
  swatch: string;
};

const NO_TEXT = "No text, letters, numbers or logos anywhere in the image.";

export const ART_STYLES: Record<ArtStyleId, ArtStyle> = {
  textbook: {
    id: "textbook",
    label: "Ders kitabı illüstrasyonu",
    description: "Sıcak, net, dijital boyalı eğitim illüstrasyonu (varsayılan).",
    prompt: `Style: warm, professional educational textbook illustration - clean digital painting, friendly and inclusive characters, clear readable shapes, soft even lighting, bright but not neon colours. ${NO_TEXT}`,
    swatch: "linear-gradient(135deg,#fde68a,#60a5fa)",
  },
  "3d-render": {
    id: "3d-render",
    label: "3D animasyon",
    description: "Pixar benzeri 3D render: yumuşak ışık, sevimli karakterler, derinlik.",
    prompt: `Style: high-quality 3D animated film render - stylised characters with large expressive eyes and soft rounded forms, subsurface-scattering skin, soft global illumination, gentle depth of field, rich saturated colours, family-film look. ${NO_TEXT}`,
    swatch: "radial-gradient(circle at 30% 30%,#fff7ed,#fb923c 45%,#7c2d12)",
  },
  "flat-vector": {
    id: "flat-vector",
    label: "Düz vektör",
    description: "Modern, sade, düz renkli vektör çizim; ikon gibi net.",
    prompt: `Style: modern flat vector illustration - simple geometric shapes, flat colour fills with subtle shading, clean outlines-free edges, limited harmonious palette, generous negative space. ${NO_TEXT}`,
    swatch: "linear-gradient(135deg,#34d399 0 50%,#6366f1 50%)",
  },
  watercolor: {
    id: "watercolor",
    label: "Suluboya",
    description: "Yumuşak suluboya dokusu, sıcak hikâye kitabı havası.",
    prompt: `Style: soft watercolour children's-book illustration - visible paper texture, gentle colour bleeds, delicate ink linework, warm natural light, calm pastel palette. ${NO_TEXT}`,
    swatch: "linear-gradient(135deg,#bfdbfe,#fbcfe8,#fef3c7)",
  },
  "pencil-storybook": {
    id: "pencil-storybook",
    label: "Kurşun kalem + renk",
    description: "Renkli kalem ve kurşun kalem dokulu klasik hikâye kitabı.",
    prompt: `Style: classic storybook illustration in coloured pencil and graphite - hand-drawn line quality, visible pencil hatching, warm muted colours, cosy detailed backgrounds. ${NO_TEXT}`,
    swatch: "repeating-linear-gradient(45deg,#e7e5e4 0 3px,#a8a29e 3px 4px)",
  },
  "photo-realistic": {
    id: "photo-realistic",
    label: "Fotoğraf gerçekçi",
    description: "Gerçek fotoğraf görünümü; yetişkin/ileri seviye kitaplar için.",
    prompt: `Style: natural editorial photograph - realistic people and places, natural light, shallow depth of field, authentic everyday setting, documentary feel, no heavy retouching. ${NO_TEXT}`,
    swatch: "linear-gradient(135deg,#78716c,#d6d3d1 60%,#57534e)",
  },
};

export const ART_STYLE_IDS = Object.keys(ART_STYLES) as ArtStyleId[];
export const DEFAULT_ART_STYLE: ArtStyleId = "textbook";

export function isArtStyleId(value: unknown): value is ArtStyleId {
  return typeof value === "string" && value in ART_STYLES;
}

export function resolveArtStyle(id: string | null | undefined): ArtStyle {
  return (id && ART_STYLES[id as ArtStyleId]) || ART_STYLES[DEFAULT_ART_STYLE];
}
