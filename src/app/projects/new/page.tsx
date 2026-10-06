import { NewProjectForm } from "./NewProjectForm";

// Server wrapper so the home page's "Sıfırdan tasarla" tile can deep-link
// straight into scratch mode via ?mode=scratch.
export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { mode } = await searchParams;
  return <NewProjectForm initialMode={mode === "scratch" ? "scratch" : "source"} />;
}
