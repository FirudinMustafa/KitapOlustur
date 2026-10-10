"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BookHeartIcon,
  BookOpenIcon,
  FileUpIcon,
  Loader2Icon,
  PaletteIcon,
  PlusIcon,
  RocketIcon,
  SettingsIcon,
  SparklesIcon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react";
import { isValidIsbn13 } from "@/lib/isbn";
import { TRIM_SIZES, type TrimSizeId } from "@/lib/pdf/page-geometry";
import { DEFAULT_DESIGN_THEME, type DesignThemeId } from "@/lib/design/themes";
import { ThemePicker } from "@/components/app/theme-picker";
import { PictureBookForm } from "./PictureBookForm";
import { ArtStylePicker } from "@/components/app/art-style-picker";
import { DEFAULT_ART_STYLE, type ArtStyleId } from "@/lib/ai/art-styles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { FileDropzone } from "@/components/app/file-dropzone";

type NiceToHaveItem = {
  id: string;
  key: string;
  label: string;
  description: string;
  isDefaultSelected: boolean;
};

type StyleProfile = {
  id: string;
  key: string;
  name: string;
  description: string;
  isDefault: boolean;
};

// Denetim sonrası düzeltme (2026-09-23): variantCount'un 1-4 kelepçelemesiyle
// aynı gerekçe - sıfırdan modda gerçek bir kaynak PDF (dolayısıyla doğal bir
// üst sınır) olmadığından, bir yazım hatası (örn. 500) onlarca gerçek AI
// üretim çağrısını tetikleyebilir. Hem client hem API (route.ts) bu sınırı
// uyguluyor.
const MAX_UNIT_LIMIT = 30;

// Denetim sonrası düzeltme: sıfırdan modda gerçek varsayılanı kullanıcıya
// göstermek için - workflows/book-pipeline.tsx'teki DEFAULT_SCRATCH_UNIT_SKELETON
// ile birebir aynı tutulmalı (ayrı bir paylaşılan modül gerektirmeyecek kadar
// küçük ve durağan bir sabit, o yüzden burada kopyalandı).
const DEFAULT_SCRATCH_UNIT_SKELETON = ["Giriş", "Ana İçerik", "Alıştırmalar", "Özet"];

const OUTPUT_BOOK_TYPES: { value: string; label: string; description: string }[] = [
  { value: "student_book", label: "Student Book", description: "Ana ders kitabı" },
  { value: "workbook", label: "Workbook", description: "Alıştırma kitabı" },
  { value: "teacher_book", label: "Teacher's Book", description: "Ders planları ve cevaplar" },
  { value: "test_booklet", label: "Test Kitapçığı", description: "Ünite, ara ve final sınavları" },
];

const BOOK_TYPE_ITEMS = { student_book: "Student Book", workbook: "Workbook" };

// Selectable tile wrapper for checkbox/radio options.
const OPTION_TILE =
  "flex cursor-pointer items-start gap-3 rounded-xl border bg-background/60 p-3 text-sm transition-colors hover:border-primary/40 hover:bg-accent/40 has-[[data-checked]]:border-primary/60 has-[[data-checked]]:bg-accent/60";

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-5 py-5">
      <CardHeader className="px-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 px-5">{children}</CardContent>
    </Card>
  );
}

export function NewProjectForm({
  initialMode,
  pictureBookPrefill,
}: {
  initialMode: "source" | "scratch" | "picturebook";
  pictureBookPrefill?: { idea: string; brief: string };
}) {
  const router = useRouter();

  const [items, setItems] = useState<NiceToHaveItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [styleProfiles, setStyleProfiles] = useState<StyleProfile[]>([]);
  const [styleProfileId, setStyleProfileId] = useState<string>("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [isbn, setIsbn] = useState("");
  const [bookType, setBookType] = useState<"student_book" | "workbook">("student_book");
  const [outputTypes, setOutputTypes] = useState<Set<string>>(new Set(["student_book", "workbook"]));
  const [variantCount, setVariantCount] = useState("1");
  const [qualityMode, setQualityMode] = useState<"draft" | "final">("final");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [unitLimit, setUnitLimit] = useState("");
  // Faz "Sabit Ünite İskeleti": opt-in, kullanıcı tanımlı bölüm sırası -
  // varsayılan kapalı, mevcut kaynak-PDF-mirror davranışı herkes için aynen
  // kalıyor.
  const [useSkeleton, setUseSkeleton] = useState(false);
  const [unitSkeleton, setUnitSkeleton] = useState<string[]>([]);
  const [newSectionName, setNewSectionName] = useState("");
  // Aralıklı Tekrar (Spaced Repetition) Sayfaları: opt-in, varsayılan kapalı -
  // mevcut davranış herkes için aynen kalıyor.
  const [spacedRepetition, setSpacedRepetition] = useState(false);
  // Yapılandırılabilir Trim Size: varsayılan "a4" - mevcut davranış aynen
  // kalıyor, proje oluşturulduktan sonra değiştirilemez (ISBN gibi).
  const [trimSize, setTrimSize] = useState<TrimSizeId>("a4");
  // Faz 1 "Tasarım sistemi": the PDF/reader theme - can be switched later
  // without regenerating (AI-free reassembly).
  const [designTheme, setDesignTheme] = useState<DesignThemeId>(DEFAULT_DESIGN_THEME);
  // Faz 2 "İllüstrasyon stili": one art direction for every picture.
  const [artStyle, setArtStyle] = useState<ArtStyleId>(DEFAULT_ART_STYLE);
  // Faz 3 "Referans kitapla kıyas": optional sample pages of a published
  // book; every typeset page is graded against them.
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);

  async function uploadReferences(): Promise<string[]> {
    const urls: string[] = [];
    for (const f of referenceFiles.slice(0, 5)) {
      const blob = await upload(f.name, f, { access: "public", handleUploadUrl: "/api/blob/upload", contentType: f.type });
      urls.push(blob.url);
    }
    return urls;
  }
  // "Sıfırdan Kitap" modu (2026-09-22): "scratch" hides the file upload
  // block entirely and skips the @vercel/blob/client upload() call, showing
  // a unit-count + optional brief instead (see handleSubmit's branch and
  // POST /api/projects's `mode: "scratch"` handling). The initial mode comes
  // from ?mode=scratch (home page "Sıfırdan tasarla" tile).
  const [mode, setMode] = useState<"source" | "scratch" | "picturebook">(initialMode);
  const [brief, setBrief] = useState("");
  const [file, setFile] = useState<File | null>(null);
  // Faz "Toplu/seri üretim": when more than one file is selected, the form
  // switches into batch mode - a single shared "Proje adı" doesn't make
  // sense for N files, so each gets its own name (defaulted from its
  // filename, editable) while every other setting below stays shared across
  // the whole batch.
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchNames, setBatchNames] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBatch = batchFiles.length > 1;
  const selectedFiles = isBatch ? batchFiles : file ? [file] : [];

  function handleFilesSelected(selectedList: File[]) {
    if (selectedList.length > 1) {
      setBatchFiles(selectedList);
      setBatchNames(selectedList.map((f) => f.name.replace(/\.pdf$/i, "")));
      setFile(null);
    } else {
      setBatchFiles([]);
      setBatchNames([]);
      setFile(selectedList[0] ?? null);
    }
  }

  useEffect(() => {
    fetch("/api/nice-to-have")
      .then((res) => res.json())
      .then((data: { items: NiceToHaveItem[] }) => {
        setItems(data.items);
        setSelected(new Set(data.items.filter((i) => i.isDefaultSelected).map((i) => i.id)));
      })
      .catch(() => setError("Nice-to-have listesi yüklenemedi."));

    fetch("/api/style-profiles")
      .then((res) => res.json())
      .then((data: { items: StyleProfile[] }) => {
        setStyleProfiles(data.items);
        setStyleProfileId(data.items.find((p) => p.isDefault)?.id ?? data.items[0]?.id ?? "");
      })
      .catch(() => setError("Stil profili listesi yüklenemedi."));
  }, []);

  function addSkeletonSection() {
    const sectionName = newSectionName.trim();
    if (!sectionName) return;
    setUnitSkeleton((prev) => [...prev, sectionName]);
    setNewSectionName("");
  }

  function removeSkeletonSection(index: number) {
    setUnitSkeleton((prev) => prev.filter((_, i) => i !== index));
  }

  function moveSkeletonSection(index: number, direction: "up" | "down") {
    setUnitSkeleton((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleOutputType(value: string) {
    setOutputTypes((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!outputTypes.size) {
      setError("Lütfen en az bir çıktı kitap tipi seçin.");
      return;
    }

    if (mode === "scratch") {
      if (!name.trim()) {
        setError("Lütfen bir kitap adı/konusu girin.");
        return;
      }
      const unitCount = Number(unitLimit.trim());
      if (!unitLimit.trim() || !Number.isInteger(unitCount) || unitCount <= 0 || unitCount > MAX_UNIT_LIMIT) {
        setError(`Lütfen 1-${MAX_UNIT_LIMIT} arası bir ünite sayısı girin.`);
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "scratch",
            name,
            level,
            bookType,
            customNotes,
            brief: brief.trim() || null,
            niceToHaveIds: Array.from(selected),
            styleProfileId: styleProfileId || null,
            qualityMode,
            targetLanguage: targetLanguage.trim() || null,
            requestedBookTypes: Array.from(outputTypes),
            variantCount: Number(variantCount) || 1,
            unitLimit: unitCount,
            unitSkeleton: useSkeleton && unitSkeleton.length ? unitSkeleton : null,
            spacedRepetition,
            trimSize,
            designTheme,
            artStyle,
            referencePageUrls: await uploadReferences(),
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
      return;
    }

    if (isBatch) {
      if (batchNames.some((n) => !n.trim())) {
        setError("Lütfen her dosya için bir proje adı girin.");
        return;
      }
      setSubmitting(true);
      try {
        const uploaded = await Promise.all(
          batchFiles.map(async (f, i) => {
            const blob = await upload(f.name, f, {
              access: "public",
              handleUploadUrl: "/api/blob/upload",
              contentType: "application/pdf",
            });
            return { name: batchNames[i], blobUrl: blob.url, filename: f.name };
          }),
        );

        const res = await fetch("/api/projects/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: uploaded,
            level,
            bookType,
            customNotes,
            niceToHaveIds: Array.from(selected),
            styleProfileId: styleProfileId || null,
            qualityMode,
            targetLanguage: targetLanguage.trim() || null,
            requestedBookTypes: Array.from(outputTypes),
            variantCount: Number(variantCount) || 1,
            unitLimit: unitLimit.trim() ? Number(unitLimit.trim()) : null,
            unitSkeleton: useSkeleton && unitSkeleton.length ? unitSkeleton : null,
            spacedRepetition,
            trimSize,
            designTheme,
            artStyle,
            referencePageUrls: await uploadReferences(),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Bir hata oluştu.");
        }
        router.push("/projects");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bir hata oluştu.");
        setSubmitting(false);
      }
      return;
    }

    if (!file) {
      setError("Lütfen bir PDF dosyası seçin.");
      return;
    }
    if (!name.trim()) {
      setError("Lütfen bir proje adı girin.");
      return;
    }
    if (isbn.trim() && !isValidIsbn13(isbn)) {
      setError("Girilen ISBN geçerli bir ISBN-13 değil (sağlama toplamı tutmuyor).");
      return;
    }

    setSubmitting(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
        contentType: "application/pdf",
      });

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          level,
          bookType,
          customNotes,
          isbn: isbn.trim() || null,
          niceToHaveIds: Array.from(selected),
          styleProfileId: styleProfileId || null,
          qualityMode,
          targetLanguage: targetLanguage.trim() || null,
          requestedBookTypes: Array.from(outputTypes),
          variantCount: Number(variantCount) || 1,
          unitLimit: unitLimit.trim() ? Number(unitLimit.trim()) : null,
          unitSkeleton: useSkeleton && unitSkeleton.length ? unitSkeleton : null,
          spacedRepetition,
          trimSize,
          designTheme,
          artStyle,
          referencePageUrls: await uploadReferences(),
          blobUrl: blob.url,
          filename: file.name,
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

  const isbnInvalid = !!isbn.trim() && !isValidIsbn13(isbn);

  return (
    <PageContainer size="narrow" className="pb-32">
      <PageHeader
        eyebrow="Yeni kitap"
        title={mode === "source" ? "Kaynaktan yepyeni bir kitap" : mode === "picturebook" ? "Resimli hikâye kitabı" : "Sıfırdan bir kitap tasarla"}
        description={
          mode === "source"
            ? "Herhangi bir konudaki ders kitabının PDF'ini yükle; konusu ve dili otomatik tespit edilip aynı yapıdan yola çıkan özgün bir versiyonu üretilecek."
            : mode === "picturebook"
              ? "Bir hikâye fikrinden; tutarlı karakterleri, tam sayfa illüstrasyonları ve baskıya hazır dosyalarıyla bir çocuk kitabı üret."
              : "Kaynak bir PDF olmadan, sadece konu, seviye ve ünite sayısı vererek yapay zekânın sıfırdan tasarladığı özgün bir ders kitabı üret."
        }
      />

      <div role="tablist" aria-label="Üretim modu" className="mt-6 grid grid-cols-1 gap-2 rounded-2xl border bg-muted/50 p-1.5 sm:grid-cols-3">
        {(
          [
            { value: "source", label: "Kaynak PDF'ten", hint: "PDF yükle", Icon: FileUpIcon },
            { value: "scratch", label: "Sıfırdan", hint: "Konu ver, üretelim", Icon: WandSparklesIcon },
            { value: "picturebook", label: "Hikâye kitabı", hint: "Resimli çocuk kitabı", Icon: BookHeartIcon },
          ] as const
        ).map(({ value, label, hint, Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all",
              mode === value
                ? "bg-background shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-lg",
                mode === value ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              <Icon className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
          </button>
        ))}
      </div>

      {mode === "picturebook" ? (
        <PictureBookForm initialIdea={pictureBookPrefill?.idea} initialBrief={pictureBookPrefill?.brief} />
      ) : (
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
        <SectionCard
          icon={mode === "source" ? FileUpIcon : SparklesIcon}
          title={mode === "source" ? "Kaynak kitap" : "Konu ve kapsam"}
          description={
            mode === "source"
              ? "Birden fazla PDF seçersen hepsi aynı ayarlarla ayrı projeler olarak başlatılır."
              : "Kitabın neyi anlatacağını ve kaç üniteden oluşacağını belirle."
          }
        >
          {mode === "source" ? (
            <FileDropzone
              files={selectedFiles}
              onFilesChange={handleFilesSelected}
              accept="application/pdf"
              multiple
              title="PDF'leri buraya sürükle"
              hint="bir seri için birden fazla seçebilirsin"
            />
          ) : (
            <Field>
              <FieldLabel htmlFor="brief">Kısa brief (opsiyonel)</FieldLabel>
              <Textarea
                id="brief"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={3}
                placeholder="Örn. günlük konuşma diline ağırlık ver, dilbilgisi alıştırmalarını azalt"
              />
              <FieldDescription>
                Boş bırakılırsa yapay zekâ, konu ve seviyeye göre kendi takdiriyle bir kapsam belirler.
              </FieldDescription>
            </Field>
          )}

          {isBatch && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{batchFiles.length} kitap - her biri için proje adı</p>
              {batchFiles.map((f, i) => (
                <div key={f.name + i} className="flex items-center gap-2">
                  <Input
                    aria-label={`${f.name} için proje adı`}
                    value={batchNames[i] ?? ""}
                    onChange={(e) => setBatchNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))}
                    className="h-9 flex-1"
                  />
                  <span className="w-36 truncate text-xs text-muted-foreground" title={f.name}>
                    {f.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard icon={BookOpenIcon} title="Kitap bilgileri">
          {!isBatch && (
            <Field>
              <FieldLabel htmlFor="name">{mode === "scratch" ? "Kitap adı / konusu" : "Proje adı"}</FieldLabel>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={mode === "scratch" ? "Örn. Fotosentez ve Hücre Solunumu" : "Örn. New Horizons A2"}
                className="h-10"
              />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="level">Seviye (opsiyonel)</FieldLabel>
              <Input id="level" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Örn. A2" className="h-10" />
            </Field>
            <Field>
              <FieldLabel>{mode === "scratch" ? "Ana kitap tipi" : "Yüklenen kitap tipi"}</FieldLabel>
              <Select
                items={BOOK_TYPE_ITEMS}
                value={bookType}
                onValueChange={(v) => v && setBookType(v as "student_book" | "workbook")}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student_book">Student Book</SelectItem>
                  <SelectItem value="workbook">Workbook</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {!isBatch && (
            <Field data-invalid={isbnInvalid || undefined}>
              <FieldLabel htmlFor="isbn">ISBN (opsiyonel)</FieldLabel>
              <Input
                id="isbn"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="Örn. 978-0-306-40615-7"
                aria-invalid={isbnInvalid || undefined}
                className="h-10"
              />
              {isbnInvalid ? (
                <FieldError>Geçerli bir ISBN-13 değil (sağlama toplamı tutmuyor).</FieldError>
              ) : (
                <FieldDescription>
                  Girilirse künye sayfasına taranabilir bir EAN-13 barkod olarak basılır. Kendi satın aldığın gerçek
                  ISBN olmalı.
                </FieldDescription>
              )}
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="lang">Hedef dil (opsiyonel)</FieldLabel>
            <Input
              id="lang"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              placeholder="Örn. Almanca, German, de"
              className="h-10"
            />
            <FieldDescription>
              Boş bırakılırsa kaynak kitabın dili kullanılır. Belirtilirse kitap o dilde yeniden yazılır (çeviri değil).
            </FieldDescription>
          </Field>
        </SectionCard>

        <SectionCard icon={RocketIcon} title="Çıktılar" description="Hangi kitapların ve kaç ünitenin üretileceği.">
          <div className="grid gap-2 sm:grid-cols-2">
            {OUTPUT_BOOK_TYPES.map((type) => (
              <label key={type.value} className={OPTION_TILE}>
                <Checkbox
                  checked={outputTypes.has(type.value)}
                  onCheckedChange={() => toggleOutputType(type.value)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium">{type.label}</span>
                  <span className="block text-xs text-muted-foreground">{type.description}</span>
                </span>
              </label>
            ))}
          </div>
          {outputTypes.has("test_booklet") && (
            <p className="-mt-2 text-xs text-muted-foreground">
              4+ ünite varsa otomatik olarak bir ara sınav, 2+ ünite varsa bir final sınavı eklenir.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="units">{mode === "scratch" ? "Ünite sayısı" : "Ünite sınırı (opsiyonel)"}</FieldLabel>
              <Input
                id="units"
                type="number"
                min={1}
                max={MAX_UNIT_LIMIT}
                value={unitLimit}
                onChange={(e) => setUnitLimit(e.target.value)}
                placeholder={mode === "scratch" ? "Örn. 6" : "Örn. 4"}
                className="h-10"
              />
              <FieldDescription>
                {mode === "scratch" ? `En fazla ${MAX_UNIT_LIMIT}.` : "Hızlı test için sadece ilk N ünite üretilir."}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="variants">Ünite başına varyant</FieldLabel>
              <Input
                id="variants"
                type="number"
                min={1}
                max={4}
                value={variantCount}
                onChange={(e) => setVariantCount(e.target.value)}
                className="h-10"
              />
              <FieldDescription>1&apos;den fazlaysa her ünite için aralarından seçim yaparsın.</FieldDescription>
            </Field>
          </div>
        </SectionCard>

        <SectionCard icon={PaletteIcon} title="Stil ve kalite">
          <Field>
            <FieldLabel>Stil profili</FieldLabel>
            {styleProfiles.length === 0 ? (
              <div className="grid gap-2">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : (
              <RadioGroup value={styleProfileId} onValueChange={(v) => setStyleProfileId(String(v))}>
                {styleProfiles.map((profile) => (
                  <label key={profile.id} className={OPTION_TILE}>
                    <RadioGroupItem value={profile.id} className="mt-0.5" />
                    <span>
                      <span className="block font-medium">{profile.name}</span>
                      <span className="block text-xs text-muted-foreground">{profile.description}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            )}
          </Field>

          <Field>
            <FieldLabel>Üretim kalitesi</FieldLabel>
            <RadioGroup
              value={qualityMode}
              onValueChange={(v) => setQualityMode(v as "draft" | "final")}
              className="sm:grid-cols-2"
            >
              <label className={OPTION_TILE}>
                <RadioGroupItem value="final" className="mt-0.5" />
                <span>
                  <span className="block font-medium">Final</span>
                  <span className="block text-xs text-muted-foreground">
                    Tam kalite, basılabilir sonuç için en güçlü metin ve görsel modelleri. Varsayılan.
                  </span>
                </span>
              </label>
              <label className={OPTION_TILE}>
                <RadioGroupItem value="draft" className="mt-0.5" />
                <span>
                  <span className="block font-medium">Taslak</span>
                  <span className="block text-xs text-muted-foreground">
                    Daha hızlı ve ucuz modellerle yapıyı önizlemek için. Kalite incelemesi yine tam kaliteyle yapılır.
                  </span>
                </span>
              </label>
            </RadioGroup>
          </Field>

          <Field>
            <FieldLabel>Tasarım teması</FieldLabel>
            <ThemePicker value={designTheme} onChange={setDesignTheme} />
            <FieldDescription>
              Kapak, renkler, yazı tipi ve kutu stilleri. Kitap hazır olduktan sonra da yapay zekâ maliyeti olmadan
              değiştirilebilir.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>İllüstrasyon stili</FieldLabel>
            <ArtStylePicker value={artStyle} onChange={setArtStyle} />
            <FieldDescription>
              Kapak, karakter çizimleri ve tüm sayfa görselleri bu stilde üretilir. Karakterler önce bir kez çizilir ve
              senin onayından sonra bütün kitapta aynı görünür.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Referans kitap sayfaları (opsiyonel)</FieldLabel>
            <FileDropzone
              files={referenceFiles}
              onFilesChange={(files) => setReferenceFiles(files.slice(0, 5))}
              accept="application/pdf,image/png,image/jpeg"
              multiple
              title="Ulaşmak istediğin kitabın sayfalarını bırak"
              hint="PDF veya PNG/JPG, en fazla 5 dosya"
            />
            <FieldDescription>
              Her dizilmiş sayfa bu örneklere göre puanlanır ve aradaki fark raporlanır. Boş bırakılırsa yüklenen kaynak
              kitabın sayfaları ölçüt alınır. İçerik kopyalanmaz, sadece tasarım kalitesi kıyaslanır.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Baskı boyutu</FieldLabel>
            <RadioGroup value={trimSize} onValueChange={(v) => setTrimSize(v as TrimSizeId)} className="sm:grid-cols-3">
              {(Object.keys(TRIM_SIZES) as TrimSizeId[]).map((id) => (
                <label key={id} className={OPTION_TILE}>
                  <RadioGroupItem value={id} className="mt-0.5" />
                  <span className="font-medium">
                    {TRIM_SIZES[id].label}
                    {id === "a4" && <span className="block text-xs font-normal text-muted-foreground">varsayılan</span>}
                  </span>
                </label>
              ))}
            </RadioGroup>
            <FieldDescription>
              PDF&apos;in fiziksel sayfa boyutu - proje oluşturulduktan sonra değiştirilemez. Dizilim ve web okuyucu
              önizlemesi A4 oranında kalır.
            </FieldDescription>
          </Field>
        </SectionCard>

        <SectionCard icon={SettingsIcon} title="İçerik tercihleri" description="İyileştirmeler, notlar ve deneysel özellikler.">
          <Field>
            <FieldLabel>Nice-to-have iyileştirmeler</FieldLabel>
            {items.length === 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((item) => (
                  <label key={item.id} className={OPTION_TILE}>
                    <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleItem(item.id)} className="mt-0.5" />
                    <span>
                      <span className="block font-medium">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">{item.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="notes">Ek notlar (opsiyonel)</FieldLabel>
            <Textarea
              id="notes"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              rows={3}
              placeholder="Örn. daha fazla uygulama örneği, gerçek hayat bağlamı vb."
            />
          </Field>

          <div className="flex flex-col gap-3 rounded-xl border p-4">
            <label className="flex cursor-pointer items-start justify-between gap-4">
              <span>
                <span className="block text-sm font-medium">
                  {mode === "scratch" ? "Özel bölüm sırası kullan" : "Sabit ünite iskeleti kullan"}
                  <span className="ml-1.5 rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning-soft-foreground">
                    deneysel
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {mode === "scratch" ? (
                    <>
                      Kapalıysa her ünite şu bölümlerle üretilir:{" "}
                      <strong>{DEFAULT_SCRATCH_UNIT_SKELETON.join(", ")}</strong>.
                    </>
                  ) : (
                    <>
                      Her ünite, kaynak PDF&apos;in sayfa düzeni yerine aşağıda tanımladığın bölüm sırasıyla üretilir
                      (örn. Dilbilgisi, Kelime, Okuma, Dinleme).
                    </>
                  )}
                </span>
              </span>
              <Switch checked={useSkeleton} onCheckedChange={setUseSkeleton} />
            </label>
            {useSkeleton && (
              <div className="flex flex-col gap-2">
                {unitSkeleton.length === 0 && <p className="text-sm text-muted-foreground">Henüz bölüm eklenmedi.</p>}
                {unitSkeleton.map((section, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-1.5">
                    <span className="w-6 text-xs text-muted-foreground">{i + 1}.</span>
                    <span className="flex-1 text-sm">{section}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Yukarı taşı"
                      onClick={() => moveSkeletonSection(i, "up")}
                      disabled={i === 0}
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Aşağı taşı"
                      onClick={() => moveSkeletonSection(i, "down")}
                      disabled={i === unitSkeleton.length - 1}
                    >
                      <ArrowDownIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Bölümü sil"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeSkeletonSection(i)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkeletonSection();
                      }
                    }}
                    placeholder="Örn. Dinleme"
                    className="h-9 flex-1"
                  />
                  <Button type="button" variant="outline" onClick={addSkeletonSection}>
                    <PlusIcon data-icon="inline-start" />
                    Ekle
                  </Button>
                </div>
              </div>
            )}
          </div>

          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border p-4">
            <span>
              <span className="block text-sm font-medium">
                Aralıklı tekrar sayfaları
                <span className="ml-1.5 rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning-soft-foreground">
                  deneysel
                </span>
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Her 4 ünitede bir, önceki ünitelerin kelime ve dilbilgisini pekiştiren ek &quot;Tekrar&quot; sayfaları
                eklenir.
              </span>
            </span>
            <Switch checked={spacedRepetition} onCheckedChange={setSpacedRepetition} />
          </label>
        </SectionCard>

        <div className="sticky bottom-4 z-10">
          <div className="flex flex-col gap-3 rounded-2xl border bg-background/85 p-3 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
            <p className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")} role={error ? "alert" : undefined}>
              {error ??
                (isBatch
                  ? `${batchFiles.length} kitap aynı ayarlarla başlatılacak.`
                  : `${outputTypes.size} kitap tipi seçili.`)}
            </p>
            <Button type="submit" size="lg" disabled={submitting} className="shrink-0">
              {submitting ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <RocketIcon data-icon="inline-start" />
              )}
              {submitting ? "Yükleniyor…" : isBatch ? `${batchFiles.length} orkestrayı başlat` : "Orkestra'yı başlat"}
            </Button>
          </div>
        </div>
      </form>
      )}
    </PageContainer>
  );
}
