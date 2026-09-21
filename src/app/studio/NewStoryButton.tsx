"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
    <Button onClick={createStory} disabled={loading}>
      {loading ? "Oluşturuluyor…" : "Yeni Hikaye"}
    </Button>
  );
}
