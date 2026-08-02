"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type NiceToHaveItem = {
  id: string;
  key: string;
  label: string;
  description: string;
  isDefaultSelected: boolean;
};

export default function NewProjectPage() {
  const router = useRouter();

  const [items, setItems] = useState<NiceToHaveItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [bookType, setBookType] = useState<"student_book" | "workbook">("student_book");
  const [customNotes, setCustomNotes] = useState("");
  const [unitLimit, setUnitLimit] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/nice-to-have")
      .then((res) => res.json())
      .then((data: { items: NiceToHaveItem[] }) => {
        setItems(data.items);
        setSelected(new Set(data.items.filter((i) => i.isDefaultSelected).map((i) => i.id)));
      })
      .catch(() => setError("Nice-to-have listesi yüklenemedi."));
  }, []);

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Lütfen bir PDF dosyası seçin.");
      return;
    }
    if (!name.trim()) {
      setError("Lütfen bir proje adı girin.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("level", level);
      formData.set("bookType", bookType);
      formData.set("customNotes", customNotes);
      formData.set("niceToHaveIds", JSON.stringify(Array.from(selected)));
      if (unitLimit.trim()) formData.set("unitLimit", unitLimit.trim());
      formData.set("file", file);

      const res = await fetch("/api/projects", { method: "POST", body: formData });
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
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Yeni kitap yükle</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Bir İngilizce kitabın PDF&apos;ini yükle; dizelgesi çıkarılıp aynı yapıdan daha iyi bir
        versiyonu üretilecek.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Proje adı</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn. New Horizons A2"
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Seviye (opsiyonel)</label>
            <input
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="Örn. A2"
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Yüklenen kitap tipi</label>
            <select
              value={bookType}
              onChange={(e) => setBookType(e.target.value as "student_book" | "workbook")}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="student_book">Student Book</option>
              <option value="workbook">Workbook</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Kaynak PDF</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-950 file:px-3 file:py-2 file:text-sm file:text-white dark:text-zinc-300 dark:file:bg-white dark:file:text-black"
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Nice-to-have iyileştirmeler
          </legend>
          <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            {items.length === 0 && (
              <p className="text-sm text-zinc-500">Yükleniyor…</p>
            )}
            {items.map((item) => (
              <label key={item.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggleItem(item.id)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.label}</span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">{item.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Ek notlar (opsiyonel)
          </label>
          <textarea
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            rows={3}
            placeholder="Örn. daha fazla telaffuz alıştırması, iş İngilizcesi bağlamı vb."
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Ünite sınırı (opsiyonel)
          </label>
          <input
            type="number"
            min={1}
            value={unitLimit}
            onChange={(e) => setUnitLimit(e.target.value)}
            placeholder="Örn. 4 - hızlı test için sadece ilk N üniteyi üretir"
            className="h-10 w-40 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="h-11 rounded-full bg-zinc-950 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {submitting ? "Yükleniyor…" : "Orkestra'yı başlat"}
        </button>
      </form>
    </div>
  );
}
