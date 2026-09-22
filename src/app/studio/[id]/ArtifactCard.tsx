import type { storyArtifacts } from "@/db/schema";
import { Skeleton } from "@/components/ui/skeleton";

type StoryArtifact = typeof storyArtifacts.$inferSelect;

// "Hikaye Stüdyosu sohbet arayüzü yenileme" (2026-09-22): the ONE artifact
// renderer, replacing the two near-duplicate blocks that used to live
// inline in StudioWorkspace.tsx's message bubbles and in its "Galeri"
// column - `variant` controls chrome/sizing only, the media/status logic is
// shared so the two spots can never silently drift apart again.
export function ArtifactCard({ artifact, variant }: { artifact: StoryArtifact; variant: "inline" | "gallery" }) {
  const isGallery = variant === "gallery";

  return (
    <div className={isGallery ? "rounded-xl bg-card p-2 text-card-foreground ring-1 ring-foreground/10" : ""}>
      {artifact.status === "failed" ? (
        <p className="text-xs text-destructive">
          {isGallery ? "Başarısız" : "Üretim başarısız"}: {artifact.errorMessage}
        </p>
      ) : artifact.status === "pending" ? (
        <div className="flex flex-col gap-1.5">
          <Skeleton className={isGallery ? "h-24 w-full" : "h-20 w-40"} />
          <p className="text-xs text-muted-foreground">Video üretiliyor…</p>
        </div>
      ) : artifact.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- externally-hosted (Vercel Blob) generated image
        <img
          src={artifact.url ?? ""}
          alt={artifact.prompt}
          className={isGallery ? "w-full rounded-md" : "max-w-full rounded-md"}
        />
      ) : artifact.type === "audio" ? (
        <audio controls src={artifact.url ?? ""} className="w-full" />
      ) : artifact.type === "video" ? (
        <video controls src={artifact.url ?? ""} className={isGallery ? "w-full rounded-md" : "max-w-full rounded-md"} />
      ) : null}

      {isGallery && artifact.status !== "pending" && artifact.status !== "failed" && (
        <>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={artifact.prompt}>
            {artifact.prompt}
          </p>
          {artifact.costUsd != null && (
            <p className="mt-0.5 text-[10px] font-medium text-muted-foreground/70">~${artifact.costUsd.toFixed(3)}</p>
          )}
        </>
      )}
    </div>
  );
}
