import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider, Show, SignInButton, UserButton } from "@clerk/nextjs";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kitap Orkestrası",
  description: "Herhangi bir ders kitabı için student book / workbook üretim orkestrası",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="tr"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <TooltipProvider>
            <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
              <Show when="signed-in">
                <nav className="flex items-center gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  <Link href="/projects" className="hover:text-zinc-950 dark:hover:text-zinc-50">
                    Kitap Projeleri
                  </Link>
                  <Link href="/studio" className="hover:text-zinc-950 dark:hover:text-zinc-50">
                    Hikaye Stüdyosu
                  </Link>
                  <Link href="/search" className="hover:text-zinc-950 dark:hover:text-zinc-50">
                    Ara
                  </Link>
                </nav>
              </Show>
              <div className="flex items-center gap-3">
                <Show when="signed-out">
                  <SignInButton mode="modal" />
                </Show>
                <Show when="signed-in">
                  <UserButton />
                </Show>
              </div>
            </header>
            {children}
          </TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
