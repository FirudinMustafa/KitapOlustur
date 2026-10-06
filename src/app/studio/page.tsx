import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { SparklesIcon } from "lucide-react";

import { db } from "@/db/client";
import { storyProjects } from "@/db/schema";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
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
    <PageContainer>
      <PageHeader
        eyebrow="Yaratıcı alan"
        title="Hikaye Stüdyosu"
        description="Sohbet ederek serbest hikaye ve metinler yaz; görsel ve seslendirme üret."
        actions={<NewStoryButton />}
      />

      {allStoryProjects.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={SparklesIcon}
          title="Henüz bir hikaye yok"
          description="Bir konu ver, hikayeyi birlikte yazalım; istediğin sahnenin görselini ya da sesli anlatımını da üretebilirsin."
          action={<NewStoryButton label="İlk hikayeni başlat" />}
        />
      ) : (
        <StudioLibraryList storyProjects={allStoryProjects} />
      )}
    </PageContainer>
  );
}
