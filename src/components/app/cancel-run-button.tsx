"use client";

import { useState } from "react";
import { CircleStopIcon, Loader2Icon } from "lucide-react";
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

// Confirmed stop of a project's active run (POST /api/projects/[id]/cancel).
// Same dialog pattern as DeleteButton.
export function CancelRunButton({ projectId, onCancelled }: { projectId: string; onCancelled: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/cancel`, { method: "POST" });
      if (!res.ok) {
        toast.error(await responseErrorMessage(res, "Durdurulamadı"));
        return;
      }
      setOpen(false);
      toast.success("Üretim durduruldu");
      await onCancelled();
    } catch (err) {
      toast.error(networkErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
            <CircleStopIcon data-icon="inline-start" />
            Üretimi durdur
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Üretimi durdur</AlertDialogTitle>
          <AlertDialogDescription>
            Devam eden üretim durdurulacak. Şimdiye kadar yazılan içerik kaybolmaz; &quot;Yeniden çalıştır&quot; ile kaldığı
            yerden devam edebilir ya da projeyi silebilirsin.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancelling}>Vazgeç</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleCancel} disabled={cancelling}>
            {cancelling ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
            Durdur
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
