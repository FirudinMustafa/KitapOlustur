import { NewProjectForm } from "./NewProjectForm";

// Server wrapper so the home page's "Sıfırdan tasarla" tile can deep-link
// straight into scratch mode via ?mode=scratch.
export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { mode, idea, brief } = await searchParams;
  return (
    <NewProjectForm
      initialMode={mode === "scratch" || mode === "picturebook" ? mode : "source"}
      // Faz 6: Hikâye Stüdyosu's "Kitaba dönüştür" prefills the picture-book form.
      pictureBookPrefill={{ idea: typeof idea === "string" ? idea : "", brief: typeof brief === "string" ? brief : "" }}
    />
  );
}
