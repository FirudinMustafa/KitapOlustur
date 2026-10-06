import { BookOpenCheckIcon, LanguagesIcon, PrinterIcon, ShieldCheckIcon } from "lucide-react";
import { DotPattern } from "@/components/ui/dot-pattern";

const FEATURES = [
  { Icon: BookOpenCheckIcon, text: "Student book, workbook, öğretmen kitabı ve test kitapçığı tek seferde" },
  { Icon: ShieldCheckIcon, text: "Dil, seviye ve güvenlik denetimli editoryal onay zinciri" },
  { Icon: LanguagesIcon, text: "Herhangi bir konu ve dilde özgün içerik" },
  { Icon: PrinterIcon, text: "Baskıya hazır PDF, ISBN barkodu ve trim size desteği" },
];

// Two-column auth frame: brand panel (hidden on mobile) + Clerk form.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[oklch(0.2_0.03_275)] p-12 text-[oklch(0.95_0.01_85)] lg:flex lg:flex-col lg:justify-between">
        <DotPattern width={20} height={20} className="text-white/[0.08]" />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_15%_0%,oklch(0.55_0.2_279.5/0.55),transparent),radial-gradient(ellipse_55%_45%_at_100%_100%,oklch(0.65_0.15_45/0.35),transparent)]"
        />
        <div className="relative flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 font-heading text-xl ring-1 ring-white/15 backdrop-blur">
            K
          </span>
          <span className="font-heading text-lg">Kitap Orkestrası</span>
        </div>

        <div className="relative max-w-md">
          <p className="font-heading text-4xl leading-tight font-light">
            &ldquo;İyi bir kitap, <em className="text-[oklch(0.82_0.11_60)]">iyi bir orkestra</em>{" "}
            gibi; her ses
            yerli yerinde.&rdquo;
          </p>
          <ul className="mt-10 flex flex-col gap-4">
            {FEATURES.map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-white/75">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/10">
                  <Icon className="size-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} Kitap Orkestrası</p>
      </aside>

      <main className="relative flex items-center justify-center px-4 py-12">
        <DotPattern
          width={18}
          height={18}
          className="text-foreground/[0.06] [mask-image:radial-gradient(400px_circle_at_center,white,transparent)] lg:hidden"
        />
        <div className="relative flex flex-col items-center gap-6">
          <div className="flex items-center gap-2 lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-warm font-heading text-lg text-primary-foreground">
              K
            </span>
            <span className="font-heading text-lg">Kitap Orkestrası</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
