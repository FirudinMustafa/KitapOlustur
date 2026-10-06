import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import type { storyProjects } from "@/db/schema";
import { Badge } from "@/components/ui/badge";

type StoryProject = typeof storyProjects.$inferSelect;

function hueFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function StudioLibraryList({ storyProjects }: { storyProjects: StoryProject[] }) {
  return (
    <ul className="mt-8 grid gap-3 sm:grid-cols-2">
      {storyProjects.map((story) => {
        const hue = hueFor(story.id);
        return (
          <li key={story.id}>
            <Link
              href={`/studio/${story.id}`}
              className="group flex h-full items-start gap-3 rounded-2xl border bg-card p-4 text-card-foreground transition-all hover:-translate-y-px hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
            >
              <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-xl font-heading text-lg text-white shadow-sm"
                style={{ background: `linear-gradient(135deg, oklch(0.62 0.13 ${hue}), oklch(0.5 0.13 ${(hue + 50) % 360}))` }}
              >
                {(story.title.match(/[\p{L}\p{N}]/u)?.[0] ?? "H").toLocaleUpperCase("tr-TR")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-base font-medium text-foreground">{story.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(story.updatedAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
                </p>
                <Badge variant="secondary" className="mt-2">
                  {story.qualityMode === "draft" ? "Taslak" : "Final"}
                </Badge>
              </div>
              <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
