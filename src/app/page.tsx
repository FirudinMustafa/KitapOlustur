import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-24">
      <div className="flex w-full max-w-xl flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Kitap Orkestrası
          </h1>
          <p className="text-lg leading-7 text-muted-foreground">
            Herhangi bir ders kitabının student book / workbook PDF&apos;ini yükle, konusunu ve dilini
            otomatik tespit edip aynı yapıdan yola çıkan özgün bir versiyonunu ürettir.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="h-11 rounded-full px-6" render={<Link href="/projects/new" />}>
            Yeni kitap yükle
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-11 rounded-full px-6"
            render={<Link href="/projects" />}
          >
            Projeleri görüntüle
          </Button>
        </div>
      </div>
    </div>
  );
}
