import { generateImage, experimental_generateSpeech as generateSpeech } from "ai";
import { put } from "@vercel/blob";
import { resolveImageModel, resolveSpeechModel, resolveVeoModel } from "@/lib/ai/model";
import { submitImageToVideo } from "@/lib/ai/higgsfield";
import { generateVeoVideoFromImage } from "@/lib/ai/veo";

// Hikaye Stüdyosu: shared generation primitives for the chat studio, called
// either by the model's own tool-calling (see the `tools` passed to
// generateText in the messages route) or directly by a UI button - both
// paths go through these same two functions so the logic never forks.
//
// Deliberately simpler than workflows/book-pipeline.tsx's
// generateReviewedImage/generateListeningAudio: no QA review loop, no
// retry-with-revised-prompt. This is user-directed free-form content, not a
// fixed-schema coursebook page - if the user doesn't like the result they
// just ask again in the chat, so a single attempt per request is the right
// tradeoff (avoids doubling image-generation cost on every message).

export type StudioGenerationResult =
  | { status: "done"; url: string; model: string }
  | { status: "failed"; model: string; errorMessage: string };

const HIGGSFIELD_VIDEO_MODEL = "higgsfield/kling-v2.5-turbo-standard";

export type VideoProvider = "veo" | "higgsfield";

export type StudioVideoResult =
  | { status: "pending"; model: string; providerRequestId: string }
  | { status: "done"; model: string; url: string }
  | { status: "failed"; model: string; errorMessage: string };

export async function generateStoryImage(
  storyProjectId: string,
  prompt: string,
  qualityMode: "draft" | "final",
): Promise<StudioGenerationResult> {
  const model = resolveImageModel(qualityMode);
  try {
    const { image } = await generateImage({ model, prompt, aspectRatio: "16:9" });
    const blob = await put(`studio/${storyProjectId}/image-${Date.now()}.png`, Buffer.from(image.uint8Array), {
      access: "public",
      contentType: image.mediaType,
      addRandomSuffix: false,
    });
    return { status: "done", url: blob.url, model };
  } catch (err) {
    return { status: "failed", model, errorMessage: err instanceof Error ? err.message : String(err) };
  }
}

// Video is the one modality with two selectable providers (see ROADMAP.md
// "Hikaye Stüdyosu" video notu) with genuinely different shapes:
//   - "higgsfield": async (submit -> poll) - no synchronous mode exists, so
//     this only SUBMITS and returns a provider request id. The caller
//     persists a "pending" storyArtifacts row with that id; a separate poll
//     route (src/app/api/studio/projects/[id]/artifacts/[artifactId]/route.ts)
//     checks it on-demand until it reaches a terminal state. Requires its own
//     account/API key (HF_API_KEY_ID/HF_API_KEY_SECRET).
//   - "veo": synchronous (the AI SDK/Gateway handles any provider-side
//     polling internally) - resolves directly to "done"/"failed", same
//     Vercel account as every other model in this app, no extra credentials.
// Both are image-to-video only (no confirmed text-to-video path for either).
export async function generateStoryVideo(
  provider: VideoProvider,
  storyProjectId: string,
  sourceImageUrl: string,
  prompt: string,
  qualityMode: "draft" | "final",
): Promise<StudioVideoResult> {
  if (provider === "higgsfield") {
    const result = await submitImageToVideo(sourceImageUrl, prompt);
    if (!result.ok) {
      return { status: "failed", model: HIGGSFIELD_VIDEO_MODEL, errorMessage: result.errorMessage };
    }
    return { status: "pending", model: HIGGSFIELD_VIDEO_MODEL, providerRequestId: result.requestId };
  }

  const veoModel = resolveVeoModel(qualityMode);
  try {
    const imageRes = await fetch(sourceImageUrl);
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
    const result = await generateVeoVideoFromImage(
      imageBuffer,
      imageRes.headers.get("content-type") ?? "image/png",
      prompt,
      qualityMode,
    );
    if (!result.ok) {
      return { status: "failed", model: veoModel, errorMessage: result.errorMessage };
    }
    const blob = await put(
      `studio/${storyProjectId}/video-${Date.now()}.mp4`,
      Buffer.from(result.video.uint8Array),
      { access: "public", contentType: result.video.mediaType, addRandomSuffix: false },
    );
    return { status: "done", model: veoModel, url: blob.url };
  } catch (err) {
    return { status: "failed", model: veoModel, errorMessage: err instanceof Error ? err.message : String(err) };
  }
}

export async function generateStoryAudio(
  storyProjectId: string,
  text: string,
  qualityMode: "draft" | "final",
): Promise<StudioGenerationResult> {
  const model = resolveSpeechModel(qualityMode);
  try {
    const { audio } = await generateSpeech({ model, text, outputFormat: "mp3" });
    const blob = await put(`studio/${storyProjectId}/audio-${Date.now()}.mp3`, Buffer.from(audio.uint8Array), {
      access: "public",
      contentType: audio.mediaType,
      addRandomSuffix: false,
    });
    return { status: "done", url: blob.url, model };
  } catch (err) {
    return { status: "failed", model, errorMessage: err instanceof Error ? err.message : String(err) };
  }
}
