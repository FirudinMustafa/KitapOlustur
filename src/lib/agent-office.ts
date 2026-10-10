import { PERSONA_LABELS, type PersonaKey } from "@/lib/personas";

// Süreç Günlüğü: the book pipeline is a team of specialised agents - this
// maps a run's status onto who is working, who has finished and who is
// waiting for the human (src/lib/process-log.ts builds the log on top of it).
// Pure - derived from generation_runs.status/current_stage only.

export type OfficeAgentState = "idle" | "working" | "waiting_human" | "done";

export type OfficeAgent = {
  key: PersonaKey;
  label: string;
  role: string;
  color: string;
  state: OfficeAgentState;
  /** What the agent says right now (speech bubble). */
  speech?: string;
};

// Pipeline order of the run statuses (src/db/schema.ts runStatusEnum).
const STATUS_ORDER = [
  "pending",
  "mapping_pages",
  "extracting",
  "analyzing",
  "awaiting_outline_approval",
  "awaiting_logo_upload",
  "awaiting_character_approval",
  "generating",
  "reviewing",
  "awaiting_variant_selection",
  "awaiting_content_approval",
  "generating_images",
  "awaiting_image_review",
  "reviewing_coherence",
  "reviewing_design",
  "awaiting_final_approval",
  "assembling",
  "done",
];

type Desk = { key: PersonaKey; role: string; color: string; statuses: string[] };

// One desk per agent, in the order work flows through the office.
const DESKS: Desk[] = [
  { key: "kaynak_analisti", role: "Kaynağı okur, sayfa haritası ve dizelge çıkarır", color: "#0ea5e9", statuses: ["mapping_pages", "extracting", "analyzing"] },
  { key: "yayin_muduru", role: "Marka, logo ve yayın kararları", color: "#64748b", statuses: ["awaiting_logo_upload"] },
  { key: "sanat_yonetmeni", role: "Karakterleri çizdirir, sayfaları puanlar", color: "#e11d48", statuses: ["awaiting_character_approval", "reviewing_design"] },
  { key: "icerik_uretici", role: "Üniteleri yazar", color: "#f59e0b", statuses: ["generating", "awaiting_variant_selection"] },
  { key: "dil_denetcisi", role: "Dil doğruluğunu denetler", color: "#10b981", statuses: ["reviewing"] },
  { key: "seviye_uzmani", role: "Seviyeye ve yaşa uygunluğu denetler", color: "#8b5cf6", statuses: ["reviewing"] },
  { key: "gorsel_tasarimci", role: "Kapak ve sayfa görsellerini üretir", color: "#ec4899", statuses: ["generating_images", "awaiting_image_review"] },
  { key: "bas_editor", role: "Dizelgeyi, içeriği ve bütünlüğü onaya sunar", color: "#1e40af", statuses: ["awaiting_outline_approval", "awaiting_content_approval", "reviewing_coherence", "awaiting_final_approval"] },
  { key: "produksiyon", role: "PDF, baskı dosyası ve kapak açılımını dizer", color: "#78716c", statuses: ["assembling"] },
];

const WAITING_SPEECH: Record<string, string> = {
  awaiting_outline_approval: "Dizelge hazır - onayını bekliyorum.",
  awaiting_logo_upload: "Kaynakta logo var. Kendi logonu yükler misin?",
  awaiting_character_approval: "Karakterleri çizdik - bir bakar mısın?",
  awaiting_variant_selection: "Varyantlardan birini seçmeni bekliyorum.",
  awaiting_content_approval: "Üniteler yazıldı - içerik onayın gerekli.",
  awaiting_image_review: "Bazı görseller denetimden geçemedi, karar senin.",
  awaiting_final_approval: "Kitap hazır - son onayını bekliyorum.",
};

export function officeAgents(status: string, currentStage: string | null): OfficeAgent[] {
  const idx = STATUS_ORDER.indexOf(status);
  const finished = status === "done";
  const waiting = status.startsWith("awaiting_");

  return DESKS.map((desk) => {
    const lastIdx = Math.max(...desk.statuses.map((s) => STATUS_ORDER.indexOf(s)));
    let state: OfficeAgentState = "idle";
    let speech: string | undefined;

    if (desk.statuses.includes(status)) {
      // Character drawing runs under "generating_images" but is the art
      // director's job, not the illustrator's.
      state = waiting ? "waiting_human" : "working";
      speech = waiting ? WAITING_SPEECH[status] : (currentStage ?? undefined);
    } else if (status === "generating_images" && desk.key === "sanat_yonetmeni" && /karakter/i.test(currentStage ?? "")) {
      state = "working";
      speech = currentStage ?? undefined;
    } else if (finished || (idx >= 0 && idx > lastIdx)) {
      state = "done";
    }
    if (status === "generating_images" && desk.key === "gorsel_tasarimci" && /karakter/i.test(currentStage ?? "")) {
      state = "idle";
      speech = undefined;
    }

    return { key: desk.key, label: PERSONA_LABELS[desk.key], role: desk.role, color: desk.color, state, speech };
  });
}

// The agent whose desk a pipeline status belongs to (character drawing,
// which runs under generating_images, belongs to the art director).
export const AGENT_COLORS: Record<PersonaKey, string> = Object.fromEntries(
  DESKS.map((d) => [d.key, d.color]),
) as Record<PersonaKey, string>;

// Colours for the reviewers that only appear through their review records.
AGENT_COLORS.icerik_guvenligi ??= "#0f766e";
AGENT_COLORS.beceri_dengesi_uzmani ??= "#ca8a04";

export function agentForStatus(status: string, stage: string | null): PersonaKey | null {
  if (status === "generating_images" && /karakter/i.test(stage ?? "")) return "sanat_yonetmeni";
  if (status === "reviewing") return "dil_denetcisi";
  return DESKS.find((d) => d.statuses.includes(status))?.key ?? null;
}

export function officeSummary(agents: OfficeAgent[]): { working: number; waiting: number; done: number } {
  return {
    working: agents.filter((a) => a.state === "working").length,
    waiting: agents.filter((a) => a.state === "waiting_human").length,
    done: agents.filter((a) => a.state === "done").length,
  };
}
