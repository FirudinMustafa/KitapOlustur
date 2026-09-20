// Higgsfield server-to-server REST API client - video generation for
// Hikaye Stüdyosu (see ROADMAP.md and studio-generation.ts). Confirmed
// directly against Higgsfield's own docs (docs.higgsfield.ai) on
// 2026-09-19, not guessed:
//   - base URL, auth header format: docs.higgsfield.ai/docs/authentication.md
//   - this endpoint's exact request schema: confirmed via Higgsfield's
//     generated OpenAPI spec (docs.higgsfield.ai/docs/openapi.json), which
//     is the more reliable of the two sources checked (a prose docs page for
//     a different model, seedance-2.5, gave a schema that could only be
//     single-source-confirmed - Kling was chosen here specifically because
//     its full field list came from the structured spec instead).
//   - async submit -> poll shape: docs.higgsfield.ai/docs/how-to/webhooks.md
//     and the same OpenAPI spec's RequestStatus schema.
// This is a genuinely async, job-queue API (no synchronous mode is
// documented) - callers must submit, then poll `pollHiggsfieldStatus`
// across multiple requests. Never await completion inside one HTTP request.

const HIGGSFIELD_API_BASE = "https://api.higgsfield.ai";
const HIGGSFIELD_VIDEO_ENDPOINT = "/kling-video/v2.5-turbo/standard/image-to-video";

export function isHiggsfieldConfigured(): boolean {
  return Boolean(process.env.HF_API_KEY_ID && process.env.HF_API_KEY_SECRET);
}

function higgsfieldHeaders(): Record<string, string> {
  return {
    Authorization: `Key ${process.env.HF_API_KEY_ID}:${process.env.HF_API_KEY_SECRET}`,
    "Content-Type": "application/json",
  };
}

export type HiggsfieldSubmitResult =
  | { ok: true; requestId: string }
  | { ok: false; errorMessage: string };

// Submits an image-to-video job. Returns immediately with a request_id -
// the video is NOT ready yet, poll pollHiggsfieldStatus with it.
export async function submitImageToVideo(imageUrl: string, prompt: string): Promise<HiggsfieldSubmitResult> {
  if (!isHiggsfieldConfigured()) {
    return { ok: false, errorMessage: "Higgsfield API key henüz eklenmedi (HF_API_KEY_ID/HF_API_KEY_SECRET)." };
  }

  try {
    const res = await fetch(`${HIGGSFIELD_API_BASE}${HIGGSFIELD_VIDEO_ENDPOINT}`, {
      method: "POST",
      headers: higgsfieldHeaders(),
      body: JSON.stringify({ prompt, image_url: imageUrl, duration: 5 }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, errorMessage: `Higgsfield submit hatası (${res.status}): ${body.slice(0, 300)}` };
    }
    const data = (await res.json()) as { request_id?: string };
    if (!data.request_id) {
      return { ok: false, errorMessage: "Higgsfield yanıtında request_id yok." };
    }
    return { ok: true, requestId: data.request_id };
  } catch (err) {
    return { ok: false, errorMessage: err instanceof Error ? err.message : String(err) };
  }
}

export type HiggsfieldStatusResult =
  | { status: "queued" | "in_progress" }
  | { status: "completed"; videoUrl: string }
  | { status: "failed" | "nsfw" | "canceled"; errorMessage: string };

export async function pollHiggsfieldStatus(requestId: string): Promise<HiggsfieldStatusResult> {
  try {
    const res = await fetch(`${HIGGSFIELD_API_BASE}/requests/${requestId}/status`, {
      headers: higgsfieldHeaders(),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { status: "failed", errorMessage: `Higgsfield durum sorgusu hatası (${res.status}): ${body.slice(0, 300)}` };
    }
    const data = (await res.json()) as {
      status: "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled";
      error?: string | null;
      video?: { url: string };
    };
    if (data.status === "completed") {
      if (!data.video?.url) {
        return { status: "failed", errorMessage: "Higgsfield 'completed' döndü ama video URL'i yok." };
      }
      return { status: "completed", videoUrl: data.video.url };
    }
    if (data.status === "queued" || data.status === "in_progress") {
      return { status: data.status };
    }
    return { status: data.status, errorMessage: data.error ?? "Video üretimi tamamlanamadı." };
  } catch (err) {
    return { status: "failed", errorMessage: err instanceof Error ? err.message : String(err) };
  }
}
