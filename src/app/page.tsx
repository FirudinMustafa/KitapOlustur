import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-24 dark:bg-black">
      <div className="flex w-full max-w-xl flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Kitap Orkestrası
          </h1>
          <p className="text-lg leading-7 text-zinc-600 dark:text-zinc-400">
            İngilizce student book / workbook PDF&apos;lerini yükle, aynı dizelgeden yola çıkan
            daha iyi bir versiyonunu otomatik olarak ürettir.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/projects/new"
            className="flex h-11 items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Yeni kitap yükle
          </Link>
          <Link
            href="/projects"
            className="flex h-11 items-center justify-center rounded-full border border-zinc-300 px-6 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Projeleri görüntüle
          </Link>
        </div>
      </div>
    </div>
  );
}
