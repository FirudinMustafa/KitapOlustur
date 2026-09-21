import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { storyProjects } from "@/db/schema";
import { NewStoryButton } from "./NewStoryButton";
import { StudioLibraryList } from "./StudioLibraryList";

export const dynamic = "force-dynamic";

export default async function StudioLibraryPage() {
  // Faz G3'teki desenle aynı: proxy.ts zaten girişi zorunlu kılıyor, bu
  // yüzden userId burada her zaman set - redirect() yolu sadece savunma amaçlı.
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const allStoryProjects = await db.query.storyProjects.findMany({
    where: eq(storyProjects.ownerId, userId),
    orderBy: [desc(storyProjects.updatedAt)],
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Hikaye Stüdyosu</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sohbet ederek serbest hikaye/metin yaz, görsel ve seslendirme üret.
          </p>
        </div>
        <NewStoryButton />
      </div>

      {allStoryProjects.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">Henüz bir hikaye yok. Başlamak için &quot;Yeni Hikaye&quot;ye tıkla.</p>
      )}

      <StudioLibraryList storyProjects={allStoryProjects} />
    </div>
  );
}
