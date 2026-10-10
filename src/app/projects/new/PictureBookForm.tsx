"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookHeartIcon, Loader2Icon, PaletteIcon, RocketIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemePicker } from "@/components/app/theme-picker";
import { ArtStylePicker } from "@/components/app/art-style-picker";
import { TRIM_SIZES, type TrimSizeId } from "@/lib/pdf/page-geometry";
import type { DesignThemeId } from "@/lib/design/themes";
import type { ArtStyleId } from "@/lib/ai/art-styles";

// Faz 6 "Resimli hikâye kitabı": the picture-book version of project
// creation - a story idea instead of a source PDF or a unit plan. The run
// goes through the same pipeline (POST /api/projects with mode
// "picturebook"); see generatePictureBookOutline/Pages in book-pipeline.tsx.

const PAGE_COUNTS = [12, 16, 24, 32];

export function PictureBookForm({ initialIdea = "", initialBrief = "" }: { initialIdea?: string; initialBrief?: string }) {
  const router = useRouter();
  const [idea, setIdea] = useState(initialIdea);
  const [ageGroup, setAgeGroup] = useState("4-6 yaş");
  const [brief, setBrief] = useState(initialBrief);
  const [targetLanguage, setTargetLanguage] = useState("");
  const [pageCount, setPageCount] = useState(16);
  const [artStyle, setArtStyle] = useState<ArtStyleId>("watercolor");
  const [designTheme, setDesignTheme] = useState<DesignThemeId>("storybook");
  const [trimSize, setTrimSize] = useState<TrimSizeId>("7x10");
  const [qualityMode, setQualityMode] = useState<"final" | "draft">("final");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!idea.trim()) {
      setError("Lütfen hikâye fikrini yazın.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "picturebook",
          name: idea.trim(),
          level: ageGroup.trim() || null,
          brief: brief.trim() || null,
          targetLanguage: targetLanguage.trim() || null,
          pictureBookPageCount: pageCount,
          artStyle,
          designTheme,
          trimSize,
          qualityMode,
          bookType: "student_book",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Bir hata oluştu.");
      }
      const data = await res.json();
      router.push(`/projects/${data.projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookHeartIcon className="size-4" /> Hikâye
          </CardTitle>
          <CardDescription>Bir fikir yeter: kurgu, sayfa metinleri, karakterler ve tüm illüstrasyonlar üretilir.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="pb-idea">Hikâye fikri</FieldLabel>
            <Input
              id="pb-idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Örn. Uyumaktan korkan küçük bir ayının yıldızlarla arkadaş olması"
              className="h-10"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pb-brief">Notlar (opsiyonel)</FieldLabel>
            <Textarea
              id="pb-brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={3}
              placeholder="Örn. paylaşmayı anlatsın, tekrar eden bir nakarat olsun, ana karakter bir kız"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="pb-age">Yaş grubu</FieldLabel>
              <Input id="pb-age" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className="h-10" />
            </Field>
            <Field>
              <FieldLabel htmlFor="pb-lang">Dil (opsiyonel)</FieldLabel>
              <Input id="pb-lang" value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} placeholder="Türkçe" className="h-10" />
            </Field>
            <Field>
              <FieldLabel>Sayfa sayısı</FieldLabel>
              <RadioGroup value={String(pageCount)} onValueChange={(v) => setPageCount(Number(v))} className="grid-cols-4">
                {PAGE_COUNTS.map((n) => (
                  <label key={n} className="flex items-center gap-1.5 text-sm">
                    <RadioGroupItem value={String(n)} />
                    {n}
                  </label>
                ))}
              </RadioGroup>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PaletteIcon className="size-4" /> Görünüm
          </CardTitle>
          <CardDescription>Karakterler önce bir kez çizilir; onayından sonra her sayfada aynı görünür.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel>İllüstrasyon stili</FieldLabel>
            <ArtStylePicker value={artStyle} onChange={setArtStyle} />
          </Field>
          <Field>
            <FieldLabel>Tasarım teması</FieldLabel>
            <ThemePicker value={designTheme} onChange={setDesignTheme} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Baskı boyutu</FieldLabel>
              <RadioGroup value={trimSize} onValueChange={(v) => setTrimSize(v as TrimSizeId)}>
                {(Object.keys(TRIM_SIZES) as TrimSizeId[]).map((id) => (
                  <label key={id} className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value={id} />
                    {TRIM_SIZES[id].label}
                  </label>
                ))}
              </RadioGroup>
            </Field>
            <Field>
              <FieldLabel>Kalite</FieldLabel>
              <RadioGroup value={qualityMode} onValueChange={(v) => setQualityMode(v as "final" | "draft")}>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="final" /> Final
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="draft" /> Taslak (hızlı önizleme)
                </label>
              </RadioGroup>
              <FieldDescription>Taslak modda görseller daha ucuz modelle üretilir.</FieldDescription>
            </Field>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" disabled={submitting} className="self-start">
        {submitting ? <Loader2Icon className="size-4 animate-spin" /> : <RocketIcon className="size-4" />}
        Hikâye kitabını üret
      </Button>
    </form>
  );
}
