import { generateImage, experimental_generateSpeech as generateSpeech } from "ai";
import { put } from "@vercel/blob";
import { resolveImageModel, resolveSpeechModel } from "@/lib/ai/model";

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
