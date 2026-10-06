"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { networkErrorMessage, responseErrorMessage } from "@/lib/api-error";

// Confirmed DELETE of a resource, then navigate away. Used for book projects
// and stories, which previously had no way to be removed at all.
export function DeleteButton({
  endpoint,
  redirectTo,
  title,
  description,
  label = "Sil",
}: {
  endpoint: string;
  redirectTo: string;
  title: string;
  description: React.ReactNode;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        toast.error(await responseErrorMessage(res, "Silinemedi"));
        return;
      }
      setOpen(false);
      toast.success("Silindi");
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      toast.error(networkErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
            <Trash2Icon data-icon="inline-start" />
            {label}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Vazgeç</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
            Kalıcı olarak sil
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
