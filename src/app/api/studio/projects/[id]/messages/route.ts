import { NextResponse } from "next/server";
import { generateText, tool, stepCountIs, type ModelMessage } from "ai";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { storyProjects, storyMessages, storyArtifacts } from "@/db/schema";
import { requireStoryProjectOwner } from "@/lib/auth";
import { resolveTextModel } from "@/lib/ai/model";
import {
  generateStoryImage,
  generateStoryAudio,
  generateStoryVideo,
  type StudioGenerationResult,
  type VideoProvider,
} from "@/lib/ai/studio-generation";

const STUDIO_SYSTEM_PROMPT = `Sen yaratıcı bir hikaye/içerik yazım asistanısın. Kullanıcıyla sohbet ederek hikayeler, kısa metinler veya serbest içerikler yazıyorsun; ihtiyaç oldukça bunları geliştiriyor, düzenliyorsun.

Elinde üç araç var: generateImage (bir sahnenin/betimlemenin görselini üretir), generateAudio (bir metnin sesli anlatımını üretir) ve generateVideo (en son üretilen görseli kısa bir videoya dönüştürür - önce bir görsel üretilmiş olmalı, iki sağlayıcıdan biri seçilebilir: "veo" varsayılan, kullanıcı özellikle "higgsfield" isterse o kullanılır). Kullanıcı açıkça bunlardan birini istediğinde, ya da isteği bunu doğal olarak ima ettiğinde ilgili aracı kullan - hikaye yazmadan da tek başına sadece bir görsel/ses/video istenebilir, bu tamamen normal. Video sağlayıcılarından biri hesap kısıtlaması/API key eksikliği yüzünden aktif olmayabilir - aracı çağır, sonucu kullanıcıya olduğu gibi ilet. Bir aracı kullandıktan sonra kullanıcıya kısaca ne ürettiğini anlat.`;

type CreatedArtifact = {
  id: string;
  type: "image" | "audio" | "video";
  status: "pending" | "done" | "failed";
  url: string | null;
  errorMessage: string | null;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const ownerCheck = await requireStoryProjectOwner(id);
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const storyProjectRow = await db.query.storyProjects.findFirst({ where: eq(storyProjects.id, id) });
  if (!storyProjectRow) {
    return NextResponse.json({ error: "Hikaye bulunamadı" }, { status: 404 });
  }
  // Narrowed alias: TS control-flow narrowing on `storyProjectRow` doesn't
  // carry into the nested closures below (persistVideo etc.), since they
  // could in principle be invoked later - a fresh `const` sidesteps that.
  const storyProject = storyProjectRow;

  const body = await request.json().catch(() => null);
  const userText = body && typeof body.message === "string" ? body.message.trim() : "";
  // Direct UI-button shortcut: bypasses the model's own tool-calling decision
  // and calls the same underlying generation functions directly - see
  // ROADMAP.md "Hikaye Stüdyosu" for why both paths share studio-generation.ts.
  const directAction: "image" | "audio" | "video" | null =
    body?.action === "image" || body?.action === "audio" || body?.action === "video" ? body.action : null;
  const directVideoProvider: VideoProvider = body?.videoProvider === "higgsfield" ? "higgsfield" : "veo";

  if (!userText && !directAction) {
    return NextResponse.json({ error: "Mesaj boş olamaz" }, { status: 400 });
  }

  const [userMessage] = await db
    .insert(storyMessages)
    .values({ storyProjectId: id, role: "user", content: userText || `(${directAction} üretimi istendi)` })
    .returning();

  const createdArtifacts: CreatedArtifact[] = [];

  async function persistArtifact(
    type: "image" | "audio",
    prompt: string,
    result: StudioGenerationResult,
  ): Promise<CreatedArtifact> {
    const [row] = await db
      .insert(storyArtifacts)
      .values({
        storyProjectId: id,
        messageId: userMessage.id,
        type,
        url: result.status === "done" ? result.url : null,
        prompt,
        model: result.model,
        status: result.status,
        errorMessage: result.status === "failed" ? result.errorMessage : null,
      })
      .returning();
    const artifact: CreatedArtifact = {
      id: row.id,
      type,
      status: result.status,
      url: row.url,
      errorMessage: row.errorMessage,
    };
    createdArtifacts.push(artifact);
    return artifact;
  }

  async function persistVideo(prompt: string, provider: VideoProvider): Promise<CreatedArtifact> {
    // Filtered in JS, not the query, to avoid importing `and` for this
    // one-off check - this table is small per story project.
    const artifacts = await db.query.storyArtifacts.findMany({
      where: eq(storyArtifacts.storyProjectId, id),
      orderBy: [desc(storyArtifacts.createdAt)],
    });
    const sourceImage = artifacts.find((a) => a.type === "image" && a.status === "done");

    if (!sourceImage?.url) {
      const [row] = await db
        .insert(storyArtifacts)
        .values({
          storyProjectId: id,
          messageId: userMessage.id,
          type: "video",
          prompt,
          model: provider,
          status: "failed",
          errorMessage: "Video üretmek için önce bir görsel üretilmiş olmalı.",
        })
        .returning();
      const artifact: CreatedArtifact = {
        id: row.id,
        type: "video",
        status: "failed",
        url: null,
        errorMessage: row.errorMessage,
      };
      createdArtifacts.push(artifact);
      return artifact;
    }

    const result = await generateStoryVideo(
      provider,
      id,
      sourceImage.url,
      prompt || sourceImage.prompt,
      storyProject.qualityMode,
    );
    const [row] = await db
      .insert(storyArtifacts)
      .values({
        storyProjectId: id,
        messageId: userMessage.id,
        type: "video",
        prompt: prompt || sourceImage.prompt,
        model: result.model,
        status: result.status,
        url: result.status === "done" ? result.url : null,
        providerRequestId: result.status === "pending" ? result.providerRequestId : null,
        errorMessage: result.status === "failed" ? result.errorMessage : null,
      })
      .returning();
    const artifact: CreatedArtifact = {
      id: row.id,
      type: "video",
      status: result.status,
      url: row.url,
      errorMessage: row.errorMessage,
    };
    createdArtifacts.push(artifact);
    return artifact;
  }

  if (directAction) {
    const prompt = userText || "Sohbetteki en son hikaye/metin içeriği";
    const artifact =
      directAction === "video"
        ? await persistVideo(userText, directVideoProvider)
        : await persistArtifact(
            directAction,
            prompt,
            directAction === "image"
              ? await generateStoryImage(id, prompt, storyProject.qualityMode)
              : await generateStoryAudio(id, prompt, storyProject.qualityMode),
          );

    const actionLabel = { image: "görsel", audio: "sesli anlatım", video: "video" }[directAction];
    const assistantText =
      artifact.status === "done"
        ? `İstediğin ${actionLabel} oluşturdum.`
        : artifact.status === "pending"
          ? "Video üretimi başladı, hazır olunca burada görünecek."
          : `Üzgünüm, ${actionLabel} üretimi başarısız oldu: ${artifact.errorMessage}`;

    const [assistantMessage] = await db
      .insert(storyMessages)
      .values({ storyProjectId: id, role: "assistant", content: assistantText })
      .returning();

    await db.update(storyProjects).set({ updatedAt: new Date() }).where(eq(storyProjects.id, id));

    return NextResponse.json({ userMessage, assistantMessage, artifacts: createdArtifacts });
  }

  const priorMessages = await db.query.storyMessages.findMany({
    where: eq(storyMessages.storyProjectId, id),
    orderBy: [asc(storyMessages.createdAt)],
  });

  const modelMessages: ModelMessage[] = priorMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let result;
  try {
    result = await generateText({
      model: resolveTextModel(storyProject.qualityMode),
      system: STUDIO_SYSTEM_PROMPT,
      messages: modelMessages,
      stopWhen: stepCountIs(5),
      tools: {
        generateImage: tool({
          description: "Verilen betimlemeye göre bir görsel/illüstrasyon üretir.",
          inputSchema: z.object({ prompt: z.string().describe("Görselin ne göstermesi gerektiğinin betimlemesi") }),
          execute: async ({ prompt }) => {
            const genResult = await generateStoryImage(id, prompt, storyProject.qualityMode);
            const artifact = await persistArtifact("image", prompt, genResult);
            return artifact.status === "done"
              ? { status: "done", imageUrl: artifact.url }
              : { status: "failed", error: artifact.errorMessage };
          },
        }),
        generateAudio: tool({
          description: "Verilen metnin sesli anlatımını (narration) üretir.",
          inputSchema: z.object({ text: z.string().describe("Seslendirilecek metin") }),
          execute: async ({ text }) => {
            const genResult = await generateStoryAudio(id, text, storyProject.qualityMode);
            const artifact = await persistArtifact("audio", text, genResult);
            return artifact.status === "done"
              ? { status: "done", audioUrl: artifact.url }
              : { status: "failed", error: artifact.errorMessage };
          },
        }),
        generateVideo: tool({
          description: "En son üretilen görseli kısa bir videoya dönüştürür. Önce bir görsel üretilmiş olmalı.",
          inputSchema: z.object({
            motionPrompt: z.string().describe("Videoda görselin nasıl hareket etmesi/canlanması gerektiğinin betimlemesi"),
            provider: z
              .enum(["veo", "higgsfield"])
              .default("veo")
              .describe("Video sağlayıcısı - kullanıcı özellikle belirtmediyse 'veo' kullan"),
          }),
          execute: async ({ motionPrompt, provider }) => {
            const artifact = await persistVideo(motionPrompt, provider);
            return artifact.status === "done"
              ? { status: "done", videoUrl: artifact.url }
              : artifact.status === "pending"
                ? { status: "pending", note: "Video üretimi başladı, hazır olunca kullanıcıya gösterilecek." }
                : { status: "failed", error: artifact.errorMessage };
          },
        }),
      },
    });
  } catch (err) {
    // A thrown generateText error (model/gateway failure, not a tool-level
    // failure - those are caught inside persistArtifact instead) would
    // otherwise surface as Next.js's generic HTML error page, which the
    // frontend's res.json() can't parse - it shows as a misleading "network
    // error" instead of the real cause. Return a clean JSON error instead.
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Metin üretimi başarısız: ${message}` }, { status: 502 });
  }

  const assistantText = result.text || "…";

  const [assistantMessage] = await db
    .insert(storyMessages)
    .values({ storyProjectId: id, role: "assistant", content: assistantText })
    .returning();

  await db.update(storyProjects).set({ updatedAt: new Date() }).where(eq(storyProjects.id, id));

  return NextResponse.json({ userMessage, assistantMessage, artifacts: createdArtifacts });
}
