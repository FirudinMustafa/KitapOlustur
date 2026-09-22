import Link from "next/link";
import type { storyProjects } from "@/db/schema";

type StoryProject = typeof storyProjects.$inferSelect;

export function StudioLibraryList({ storyProjects }: { storyProjects: StoryProject[] }) {
  return (
    <ul className="mt-8 flex flex-col gap-3">
      {storyProjects.map((story) => (
        <li key={story.id}>
          <Link
            href={`/studio/${story.id}`}
            className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 text-card-foreground ring-1 ring-foreground/10 transition-colors hover:bg-accent hover:ring-primary/30"
          >
            {/* Sohbet arayüzündeki ChatMessage.tsx'in avatar diliyle tutarlı
                küçük bir rozet - liste ile sohbet aynı görsel sistemi paylaşsın diye. */}
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
              {story.title.charAt(0).toUpperCase() || "H"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{story.title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(story.updatedAt).toLocaleString("tr-TR")}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {story.qualityMode === "draft" ? "Taslak" : "Final"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
