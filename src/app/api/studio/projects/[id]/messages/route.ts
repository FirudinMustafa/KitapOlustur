import { NextResponse } from "next/server";
import { generateText, tool, stepCountIs, type ModelMessage } from "ai";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { storyProjects, storyMessages, storyArtifacts } from "@/db/schema";
import { requireStoryProjectOwner } from "@/lib/auth";
import { resolveTextModel } from "@/lib/ai/model";
import { generateStoryImage, generateStoryAudio, type StudioGenerationResult } from "@/lib/ai/studio-generation";

const STUDIO_SYSTEM_PROMPT = `Sen yaratıcı bir hikaye/içerik yazım asistanısın. Kullanıcıyla sohbet ederek hikayeler, kısa metinler veya serbest içerikler yazıyorsun; ihtiyaç oldukça bunları geliştiriyor, düzenliyorsun.

Elinde iki araç var: generateImage (bir sahnenin/betimlemenin görselini üretir) ve generateAudio (bir metnin sesli anlatımını üretir). Kullanıcı açıkça bir görsel veya ses istediğinde, ya da isteği bunu doğal olarak ima ettiğinde bu araçları kullan - hikaye yazmadan da tek başına sadece bir görsel ya da sadece bir ses istenebilir, bu tamamen normal. Bir aracı kullandıktan sonra kullanıcıya kısaca ne ürettiğini anlat.`;

type CreatedArtifact = {
  id: string;
  type: "image" | "audio";
  status: "done" | "failed";
  url: string | null;
  errorMessage: string | null;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const ownerCheck = await requireStoryProjectOwner(id);
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const storyProject = await db.query.storyProjects.findFirst({ where: eq(storyProjects.id, id) });
  if (!storyProject) {
    return NextResponse.json({ error: "Hikaye bulunamadı" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const userText = body && typeof body.message === "string" ? body.message.trim() : "";
  // Direct UI-button shortcut: bypasses the model's own tool-calling decision
  // and calls the same underlying generation functions directly - see
  // ROADMAP.md "Hikaye Stüdyosu" for why both paths share studio-generation.ts.
  const directAction = body?.action === "image" || body?.action === "audio" ? body.action : null;

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

  if (directAction) {
    const prompt = userText || "Sohbetteki en son hikaye/metin içeriği";
    const result =
      directAction === "image"
        ? await generateStoryImage(id, prompt, storyProject.qualityMode)
        : await generateStoryAudio(id, prompt, storyProject.qualityMode);
    const artifact = await persistArtifact(directAction, prompt, result);

    const assistantText =
      artifact.status === "done"
        ? directAction === "image"
          ? "İstediğin görseli oluşturdum."
          : "İstediğin sesli anlatımı oluşturdum."
        : `Üzgünüm, ${directAction === "image" ? "görsel" : "ses"} üretimi başarısız oldu: ${artifact.errorMessage}`;

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
