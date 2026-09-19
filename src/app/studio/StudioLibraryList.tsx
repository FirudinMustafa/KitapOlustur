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
            className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{story.title}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {new Date(story.updatedAt).toLocaleString("tr-TR")}
              </p>
            </div>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {story.qualityMode === "draft" ? "Taslak" : "Final"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
