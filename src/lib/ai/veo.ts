import { experimental_generateVideo as generateVideo } from "ai";
import { resolveVeoModel } from "@/lib/ai/model";

// Google Veo image-to-video, via the same Vercel AI Gateway as every other
// model in this app - confirmed available (modelType "video") on 2026-09-19
// via a live `gateway.getAvailableModels()` call, unlike Higgsfield this
// needs no separate account/API key. Unlike Higgsfield's async submit+poll
// design, `experimental_generateVideo` is synchronous - the AI SDK handles
// any provider-side polling internally and returns the finished video.
// Confirmed working end-to-end except for one live blocker: Veo requires a
// minimum $10 Vercel AI Gateway account balance ("Video generation requires
// a minimum balance of $10") - same account top-up that unblocks every
// other model in this app, not a Veo-specific integration issue.

export type VeoSubmitResult =
  | { ok: true; video: { uint8Array: Uint8Array; mediaType: string } }
  | { ok: false; errorMessage: string };

export async function generateVeoVideoFromImage(
  imageBytes: Buffer,
  imageMediaType: string,
  prompt: string,
  qualityMode: "draft" | "final",
): Promise<VeoSubmitResult> {
  try {
    const result = await generateVideo({
      model: resolveVeoModel(qualityMode),
      prompt,
      frameImages: [{ image: imageBytes, frameType: "first_frame" }],
    });
    return { ok: true, video: { uint8Array: result.video.uint8Array, mediaType: result.video.mediaType } };
  } catch (err) {
    return { ok: false, errorMessage: err instanceof Error ? err.message : String(err) };
  }
}
