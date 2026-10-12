import { generateImage, generateText, experimental_generateSpeech as generateSpeech } from "ai";
import { put } from "@vercel/blob";
import {
  isFreeImageModelActive,
  isFreeSpeechModelActive,
  resolveImageModel,
  resolveSpeechModel,
  resolveTextModel,
  resolveVeoModel,
  toTextModel,
  type StudioImageSizeId,
} from "@/lib/ai/model";
import { generateImageWithCloudflare } from "@/lib/ai/cloudflare-image";
import { synthesizeWithElevenLabs } from "@/lib/ai/elevenlabs";
import { estimateImageCostUsd, estimateSpeechCostUsd, estimateStudioImageCostUsd } from "@/lib/ai/pricing";
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

// QA fix (2026-10-06): the studio always went through the AI Gateway, even
// with AI_PROVIDER_MODE=free - so on a free setup every studio image/audio
// request failed with "A positive credit balance is required". Free mode now
// uses the same providers the book pipeline already uses there (Cloudflare
// Workers AI for images, ElevenLabs for speech).
const FREE_IMAGE_MODEL_LABEL = "cloudflare/flux-1-schnell";
const FREE_SPEECH_MODEL_LABEL = "elevenlabs/eleven_multilingual_v2";

async function freeImage(prompt: string) {
  const image = await generateImageWithCloudflare(prompt);
  if (!image) throw new Error("Ücretsiz görsel sağlayıcısı (Cloudflare Workers AI) görsel döndürmedi.");
  return image;
}

// Live test 2026-10-12: "make a picture of this" with a Turkish story
// produced branches and a dome, not the cat and its ball - the image model
// was handed the whole story in Turkish. A short English description of
// the story's main scene is written first; on any failure the original
// text is used as before.
export async function sceneImagePrompt(text: string): Promise<string> {
  try {
    const { text: prompt } = await generateText({
      model: toTextModel(resolveTextModel("draft")),
      system:
        "You turn a story or description (in any language) into ONE English prompt for an image generator, at most 60 words: the main scene's subject(s), what they are doing, the setting, and the mood. Concrete and visual. Output only the prompt.",
      prompt: text.slice(0, 3000),
    });
    return prompt.trim() || text;
  } catch {
    return text;
  }
}

export type StudioGenerationResult =
  | { status: "done"; url: string; model: string; costUsd: number | null }
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
  const free = isFreeImageModelActive();
  const model = free ? FREE_IMAGE_MODEL_LABEL : resolveImageModel(qualityMode);
  try {
    const scene = await sceneImagePrompt(prompt);
    // GPT Image takes a size, not an aspect ratio (see model.ts).
    const image = free ? await freeImage(scene) : (await generateImage({ model, prompt: scene, size: "1536x1024" })).image;
    const blob = await put(`studio/${storyProjectId}/image-${Date.now()}.png`, Buffer.from(image.uint8Array), {
      access: "public",
      contentType: image.mediaType,
      addRandomSuffix: false,
    });
    return { status: "done", url: blob.url, model, costUsd: free ? null : estimateImageCostUsd(model) };
  } catch (err) {
    return { status: "failed", model, errorMessage: err instanceof Error ? err.message : String(err) };
  }
}

// Faz "Gelişmiş Görsel Üretim Paneli" (2026-09-21, ROADMAP.md): a separate
// function rather than extending generateStoryImage above - that one stays
// exactly as-is for the existing simple chat/quick-button flow (fixed
// model/size/single-image, driven by qualityMode). This one backs the new
// advanced panel: the user picks the model/size/count explicitly, and can
// attach up to 4 saved reference images (OpenAI's GPT Image family's
// documented reference-image limit) via providerOptions.openai -
// input_references, verified via web research 2026-09-21, not guessed.
export type AdvancedStudioImageResult =
  | { status: "done"; urls: string[]; model: string; costUsd: number | null }
  | { status: "failed"; model: string; errorMessage: string };

export async function generateAdvancedStoryImage(
  storyProjectId: string,
  prompt: string,
  model: string,
  size: StudioImageSizeId,
  count: number,
  referenceImageUrls?: string[],
): Promise<AdvancedStudioImageResult> {
  if (isFreeImageModelActive()) {
    // Free provider: no model/size choice or reference images - size goes
    // into the prompt as guidance, same as the book pipeline does.
    try {
      const urls: string[] = [];
      for (let i = 0; i < count; i++) {
        const image = await freeImage(`${prompt}

(Image size guidance: ${size})`);
        const blob = await put(`studio/${storyProjectId}/image-${Date.now()}-${i}.png`, Buffer.from(image.uint8Array), {
          access: "public",
          contentType: image.mediaType,
          addRandomSuffix: false,
        });
        urls.push(blob.url);
      }
      return { status: "done", urls, model: FREE_IMAGE_MODEL_LABEL, costUsd: null };
    } catch (err) {
      return { status: "failed", model: FREE_IMAGE_MODEL_LABEL, errorMessage: err instanceof Error ? err.message : String(err) };
    }
  }

  try {
    const { images } = await generateImage({
      model,
      prompt,
      size,
      n: count,
      ...(referenceImageUrls?.length
        ? { providerOptions: { openai: { input_references: referenceImageUrls.slice(0, 4) } } }
        : {}),
    });
    const urls = await Promise.all(
      images.map(async (image, i) => {
        const buffer = Buffer.from(image.base64, "base64");
        const blob = await put(`studio/${storyProjectId}/image-${Date.now()}-${i}.png`, buffer, {
          access: "public",
          contentType: image.mediaType ?? "image/png",
          addRandomSuffix: false,
        });
        return blob.url;
      }),
    );
    return { status: "done", urls, model, costUsd: estimateStudioImageCostUsd(size, urls.length) };
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
  const free = isFreeSpeechModelActive();
  const model = free ? FREE_SPEECH_MODEL_LABEL : resolveSpeechModel(qualityMode);
  try {
    let bytes: Uint8Array;
    let mediaType = "audio/mpeg";
    if (free) {
      const buf = await synthesizeWithElevenLabs(text);
      if (!buf) throw new Error("Ücretsiz ses sağlayıcısı (ElevenLabs) ses döndürmedi.");
      bytes = buf;
    } else {
      const { audio } = await generateSpeech({ model, text, outputFormat: "mp3" });
      bytes = audio.uint8Array;
      mediaType = audio.mediaType;
    }
    const blob = await put(`studio/${storyProjectId}/audio-${Date.now()}.mp3`, Buffer.from(bytes), {
      access: "public",
      contentType: mediaType,
      addRandomSuffix: false,
    });
    return { status: "done", url: blob.url, model, costUsd: free ? null : estimateSpeechCostUsd(model, text.length) };
  } catch (err) {
    return { status: "failed", model, errorMessage: err instanceof Error ? err.message : String(err) };
  }
}
