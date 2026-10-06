// ElevenLabs REST client for free-mode speech (see
// isFreeSpeechModelActive's doc comment in src/lib/ai/model.ts for why this
// bypasses the ai-SDK's generateSpeech()/SpeechModel path entirely: the
// official @ai-sdk/elevenlabs package needs @ai-sdk/provider v4, which
// conflicts with this project's ai@6.0.230 (@ai-sdk/provider v3) - a real
// version mismatch, not worked around here, just avoided). Mirrors the
// plain-fetch REST client pattern already used for Higgsfield
// (src/lib/ai/higgsfield.ts) rather than going through any AI SDK.
//
// ElevenLabs' free tier is small (~10 min of audio/month) - call this
// sparingly (manual smoke tests), not on every pipeline run.

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io";

// Free mode uses a single fixed voice for every line (dialogue's per-speaker
// OpenAI voice pool - DIALOGUE_VOICE_POOL in book-pipeline.tsx - doesn't
// apply to ElevenLabs voice IDs).
//
// QA fix (2026-10-06): this used to be "Rachel" (21m00Tcm4TlvDq8ikWAM),
// which ElevenLabs has since moved to its voice library - free accounts get
// "402 paid_plan_required: Free users cannot use library voices via the
// API", so every listening clip of every free-mode run silently failed and
// no book had audio. "Sarah" is a default voice verified live to work on a
// free key (as are George/Matilda/Lily; Aria is not). Overridable via
// ELEVENLABS_VOICE_ID.
const ELEVENLABS_DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

function voiceId(): string {
  return process.env.ELEVENLABS_VOICE_ID?.trim() || ELEVENLABS_DEFAULT_VOICE_ID;
}

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export async function synthesizeWithElevenLabs(text: string): Promise<Buffer | undefined> {
  if (!isElevenLabsConfigured()) return undefined;

  try {
    const res = await fetch(`${ELEVENLABS_API_BASE}/v1/text-to-speech/${voiceId()}`, {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`ElevenLabs TTS hatası (${res.status}): ${body.slice(0, 300)}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error("ElevenLabs synthesis failed:", err instanceof Error ? err.message : String(err));
    return undefined;
  }
}
