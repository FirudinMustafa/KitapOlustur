import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { ClerkProvider, Show } from "@clerk/nextjs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// "Site QA" (2026-09-23): design audit found the reader/Dizilim UI using the
// same admin-panel sans-serif for book body text as every button/label in
// the app, with no typographic hierarchy - contributed to the "doesn't feel
// like a real book" complaint. A dedicated reading serif (only applied via
// the `.font-reading` utility in globals.css, scoped to book content) gives
// book pages a distinct feel without touching the rest of the UI.
const sourceSerif = Source_Serif_4({
  variable: "--font-reading",
  subsets: ["latin", "latin-ext"],
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
        className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full antialiased`}
      >
        <body className="min-h-full">
          <TooltipProvider>
            {/* Faz "Arayüz yenileme" (2026-09-21, ROADMAP.md): signed-out
                routes (just /sign-in, /sign-up - everything else requires
                auth via proxy.ts, so a signed-out visitor is always already
                on one of these two) render bare, no sidebar - each page
                already renders its own Clerk <SignIn>/<SignUp> form, no
                extra trigger button needed. Signed-in routes get the
                persistent ChatGPT/Claude-style sidebar shell. */}
            <Show when="signed-out">{children}</Show>
            <Show when="signed-in">
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                  <header className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
                    <SidebarTrigger />
                  </header>
                  {children}
                </SidebarInset>
              </SidebarProvider>
            </Show>
          </TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
