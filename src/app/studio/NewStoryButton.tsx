"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewStoryButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function createStory() {
    setLoading(true);
    try {
      const res = await fetch("/api/studio/projects", { method: "POST", body: JSON.stringify({}) });
      const data = await res.json();
      if (res.ok && data.storyProject?.id) {
        router.push(`/studio/${data.storyProject.id}`);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={createStory}
      disabled={loading}
      className="flex h-9 items-center justify-center rounded-full bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
    >
      {loading ? "Oluşturuluyor…" : "Yeni Hikaye"}
    </button>
  );
}
