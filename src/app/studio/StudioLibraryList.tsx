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
            className="flex items-center justify-between gap-4 rounded-xl bg-card px-4 py-3 text-card-foreground ring-1 ring-foreground/10 transition-colors hover:bg-accent hover:ring-primary/30"
          >
            <div>
              <p className="font-medium text-foreground">{story.title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(story.updatedAt).toLocaleString("tr-TR")}
              </p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {story.qualityMode === "draft" ? "Taslak" : "Final"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
