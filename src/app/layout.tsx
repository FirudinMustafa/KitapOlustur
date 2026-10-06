import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { ClerkProvider, Show } from "@clerk/nextjs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "@/components/app-sidebar";
import { AppBreadcrumbs } from "@/components/app/app-breadcrumbs";
import { ThemeProvider } from "@/components/app/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
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

// Faz "Arayüz yenileme 2" (2026-10-06): display serif for page titles and
// card headings (`font-heading`), giving the app its literary character
// while body/UI text stays on Geist.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: "Kitap Orkestrası",
  description: "Herhangi bir ders kitabı için student book / workbook üretim orkestrası",
};

// Clerk renders its own UI; pointing its variables at our CSS tokens makes
// the sign-in/up forms and UserButton popover follow the active theme.
const clerkAppearance = {
  variables: {
    colorPrimary: "var(--primary)",
    colorPrimaryForeground: "var(--primary-foreground)",
    colorBackground: "var(--card)",
    colorForeground: "var(--foreground)",
    colorMutedForeground: "var(--muted-foreground)",
    colorMuted: "var(--muted)",
    colorInput: "var(--background)",
    colorInputForeground: "var(--foreground)",
    colorBorder: "var(--border)",
    colorNeutral: "var(--foreground)",
    colorRing: "var(--ring)",
    colorDanger: "var(--danger)",
    colorSuccess: "var(--success)",
    colorWarning: "var(--warning)",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-geist-sans)",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html
        lang="tr"
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} ${fraunces.variable} h-full antialiased`}
      >
        <body className="min-h-full">
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
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
                    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-border/70 bg-background/75 px-4 backdrop-blur-md supports-backdrop-filter:bg-background/60">
                      <SidebarTrigger className="-ml-1" />
                      <Separator orientation="vertical" className="mr-1 data-vertical:h-4 data-vertical:self-center" />
                      <AppBreadcrumbs />
                    </header>
                    {children}
                  </SidebarInset>
                </SidebarProvider>
              </Show>
              <Toaster position="bottom-right" richColors closeButton />
            </TooltipProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
