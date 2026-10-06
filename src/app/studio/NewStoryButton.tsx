"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { networkErrorMessage, responseErrorMessage } from "@/lib/api-error";

export function NewStoryButton({ label = "Yeni hikaye" }: { label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function createStory() {
    setLoading(true);
    try {
      const res = await fetch("/api/studio/projects", { method: "POST", body: JSON.stringify({}) });
      if (!res.ok) {
        toast.error(await responseErrorMessage(res, "Hikaye oluşturulamadı"));
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.storyProject?.id) {
        router.push(`/studio/${data.storyProject.id}`);
      } else {
        setLoading(false);
      }
    } catch (err) {
      toast.error(networkErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <Button onClick={createStory} disabled={loading}>
      {loading ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
      {loading ? "Oluşturuluyor" : label}
    </Button>
  );
}
