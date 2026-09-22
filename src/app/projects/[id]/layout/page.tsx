import { permanentRedirect } from "next/navigation";

// "Dizilim → Gerçek Kitap" (2026-09-22): the free-form block-positioning
// capability this page used to host (LayoutEditor.tsx) was merged into
// ArrangementEditor.tsx's "Konumlandır" mode, so there's nothing unique left
// here. Kept as a redirect (not deleted outright) so a bookmarked/shared
// `/layout` URL still lands somewhere useful instead of 404ing.
export default async function LayoutEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  permanentRedirect(`/projects/${id}/dizilim`);
}
