// Cloudflare Workers AI REST client for free-mode image generation (see
// isFreeImageModelActive's doc comment in src/lib/ai/model.ts). Replaces an
// earlier attempt at routing free-mode images through Gemini's Nano Banana
// (gemini-2.5-flash-image via generateText()+files) - that path is
// correctly wired but blocked by a real, confirmed-live "free_tier_requests
// limit: 0" quota on Google's side, unrelated to model choice or code shape
// (2026-09-27 live spike, every Gemini image model tried hit the same
// limit). Cloudflare Workers AI has a genuinely usable free tier instead
// (100k requests/day, confirmed 2026-09-27 via docs.cloudflare.com) - no
// credit card, just a free Cloudflare account + API token.
//
// REST shape confirmed via developers.cloudflare.com/workers-ai/models/
// flux-1-schnell (2026-09-27): POST .../ai/run/@cf/black-forest-labs/
// flux-1-schnell with { prompt }, response wrapped in Cloudflare's standard
// API envelope { result: { image: "<base64 JPEG>" }, success, errors,
// messages }. Mirrors the plain-fetch REST client pattern already used for
// Higgsfield (src/lib/ai/higgsfield.ts) and ElevenLabs
// (src/lib/ai/elevenlabs.ts) rather than going through any AI SDK.

const CLOUDFLARE_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

export function isCloudflareImageConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
}

export async function generateImageWithCloudflare(
  prompt: string,
): Promise<{ uint8Array: Uint8Array; mediaType: string } | undefined> {
  if (!isCloudflareImageConfigured()) return undefined;

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${CLOUDFLARE_IMAGE_MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Cloudflare Workers AI hatası (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as { result?: { image?: string }; success?: boolean; errors?: unknown[] };
    if (!data.result?.image) {
      throw new Error(`Cloudflare Workers AI yanıtında görsel yok: ${JSON.stringify(data.errors ?? data).slice(0, 300)}`);
    }
    return { uint8Array: Uint8Array.from(Buffer.from(data.result.image, "base64")), mediaType: "image/jpeg" };
  } catch (err) {
    console.error("Cloudflare image generation failed:", err instanceof Error ? err.message : String(err));
    return undefined;
  }
}
