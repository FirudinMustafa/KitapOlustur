"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { isValidIsbn13 } from "@/lib/isbn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

const OUTPUT_BOOK_TYPES: { value: string; label: string }[] = [
  { value: "student_book", label: "Student Book" },
  { value: "workbook", label: "Workbook" },
  { value: "teacher_book", label: "Teacher's Book" },
  { value: "test_booklet", label: "Test Kitapçığı" },
];

export default function NewProjectPage() {
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

  function handleFilesSelected(fileList: FileList | null) {
    const selected = fileList ? Array.from(fileList) : [];
    if (selected.length > 1) {
      setBatchFiles(selected);
      setBatchNames(selected.map((f) => f.name.replace(/\.pdf$/i, "")));
      setFile(null);
    } else {
      setBatchFiles([]);
      setBatchNames([]);
      setFile(selected[0] ?? null);
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

    if (isBatch) {
      if (batchNames.some((n) => !n.trim())) {
        setError("Lütfen her dosya için bir proje adı girin.");
        return;
      }
      setSubmitting(true);
      try {
        const items = await Promise.all(
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
            items,
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

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground">Yeni kitap yükle</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Herhangi bir konudaki ders kitabının PDF&apos;ini yükle; konusu ve dili otomatik tespit
        edilip aynı yapıdan yola çıkan özgün bir versiyonu üretilecek.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        {!isBatch && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Proje adı</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. New Horizons A2"
              className="h-10"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Seviye (opsiyonel)</label>
            <Input
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="Örn. A2"
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Yüklenen kitap tipi</label>
            <select
              value={bookType}
              onChange={(e) => setBookType(e.target.value as "student_book" | "workbook")}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="student_book">Student Book</option>
              <option value="workbook">Workbook</option>
            </select>
          </div>
        </div>

        {!isBatch && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">ISBN (opsiyonel)</label>
            <Input
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="Örn. 978-0-306-40615-7 - basılı/yayınlanacak bir kitap için gerçek ISBN'in"
              className="h-10"
            />
            {isbn.trim() && !isValidIsbn13(isbn) && (
              <span className="text-xs text-destructive">
                Geçerli bir ISBN-13 değil (sağlama toplamı tutmuyor).
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Girilirse PDF&apos;in künye sayfasına gerçek, taranabilir bir EAN-13 barkod olarak basılır. Sahte/rastgele
              bir ISBN üretilmez - kendi satın aldığın gerçek ISBN&apos;i olmalı.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Hedef dil (opsiyonel)</label>
          <Input
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            placeholder="Boş bırakılırsa kaynak kitabın dili kullanılır. Örn. Almanca, German, de"
            className="h-10"
          />
          <span className="text-xs text-muted-foreground">
            Belirtilirse kitap, kaynak PDF farklı bir dilde olsa bile bu dilde üretilir (çeviri değil, o dilde
            yeniden yazım).
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Kaynak PDF</label>
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:text-primary-foreground"
          />
          <span className="text-xs text-muted-foreground">
            Birden fazla PDF seçersen, hepsi aynı ayarlarla (aşağıdaki tüm seçenekler) tek seferde, ayrı ayrı
            projeler olarak üretime başlatılır — bir serinin birden fazla kitabını aynı stille üretmek için.
          </span>
        </div>

        {isBatch && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">
              {batchFiles.length} kitap - her biri için proje adı
            </legend>
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              {batchFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={batchNames[i] ?? ""}
                    onChange={(e) =>
                      setBatchNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))
                    }
                    className="h-9 flex-1"
                  />
                  <span className="w-40 truncate text-xs text-muted-foreground" title={f.name}>
                    {f.name}
                  </span>
                </div>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-foreground">
            Üretilecek kitap tipleri
          </legend>
          <div className="flex flex-wrap gap-4 rounded-lg border border-border p-3">
            {OUTPUT_BOOK_TYPES.map((type) => (
              <label key={type.value} className="flex items-center gap-1.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={outputTypes.has(type.value)}
                  onChange={() => toggleOutputType(type.value)}
                  className="accent-primary"
                />
                {type.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-foreground">Stil profili</legend>
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            {styleProfiles.length === 0 && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}
            {styleProfiles.map((profile) => (
              <label key={profile.id} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="styleProfile"
                  checked={styleProfileId === profile.id}
                  onChange={() => setStyleProfileId(profile.id)}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  <span className="font-medium text-foreground">{profile.name}</span>
                  <span className="block text-xs text-muted-foreground">{profile.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-foreground">
            Nice-to-have iyileştirmeler
          </legend>
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground">Yükleniyor…</p>
            )}
            {items.map((item) => (
              <label key={item.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggleItem(item.id)}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            Ek notlar (opsiyonel)
          </label>
          <textarea
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            rows={3}
            placeholder="Örn. daha fazla uygulama örneği, gerçek hayat bağlamı vb."
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-foreground">Üretim kalitesi</legend>
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="qualityMode"
                checked={qualityMode === "final"}
                onChange={() => setQualityMode("final")}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="font-medium text-foreground">
                  Final (Sonnet 5 + Nano Banana Pro)
                </span>
                <span className="block text-xs text-muted-foreground">
                  Tam kalite, basılabilir sonuç için — metin Sonnet 5, görseller Nano Banana Pro (Gemini 3 Pro
                  Image) ile üretilir. Varsayılan.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="qualityMode"
                checked={qualityMode === "draft"}
                onChange={() => setQualityMode("draft")}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="font-medium text-foreground">
                  Taslak (Haiku 4.5 + Imagen 4, daha ucuz)
                </span>
                <span className="block text-xs text-muted-foreground">
                  Ünite içeriği ve görseller daha ucuz modellerle üretilir — yapıyı hızlıca önizlemek için.
                  Kalite/dil incelemesi (review) her zaman tam kalite modeliyle yapılır.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Ünite sınırı (opsiyonel)
            </label>
            <Input
              type="number"
              min={1}
              value={unitLimit}
              onChange={(e) => setUnitLimit(e.target.value)}
              placeholder="Örn. 4 - hızlı test için sadece ilk N üniteyi üretir"
              className="h-10 w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Ünite başına varyant sayısı
            </label>
            <Input
              type="number"
              min={1}
              max={4}
              value={variantCount}
              onChange={(e) => setVariantCount(e.target.value)}
              className="h-10 w-40"
            />
            <span className="text-xs text-muted-foreground">
              1&apos;den fazlaysa her ünite için aralarından seçim yapman istenir.
            </span>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting} size="lg" className="h-11 rounded-full px-6">
          {submitting
            ? "Yükleniyor…"
            : isBatch
              ? `${batchFiles.length} orkestrayı başlat`
              : "Orkestra'yı başlat"}
        </Button>
      </form>
    </div>
  );
}
