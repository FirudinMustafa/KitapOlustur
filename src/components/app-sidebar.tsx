"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { STATUS_LABELS, AWAITING_STATUSES } from "@/lib/run-status";

// Faz "Arayüz yenileme" (2026-09-21, ROADMAP.md): a persistent, ChatGPT/
// Claude-style sidebar - primary nav + a live "recents" list for both
// surfaces this app has (book projects, Hikaye Stüdyosu stories), fetched
// client-side from the existing list endpoints (/api/projects,
// /api/studio/projects) rather than server-rendered in layout.tsx, so the
// root layout stays a simple server component and the sidebar can refresh
// its own recents independently of page navigation.
//
// This shadcn install's sidebar primitives are built on Base UI's `render`
// prop (a ReactElement to compose onto, like Radix's `asChild` but not
// named that here - see src/components/ui/sidebar.tsx's own
// `@base-ui/react/use-render` import) rather than `asChild` - every
// SidebarMenuButton below uses `render={<Link .../>}`, not `asChild` +
// nested children.
const NAV_ITEMS = [
  { href: "/projects", label: "Kitap Projeleri" },
  { href: "/studio", label: "Hikaye Stüdyosu" },
  { href: "/search", label: "Ara" },
];

type RecentProject = { id: string; name: string; latestRun: { status: string } | null };
type RecentStory = { id: string; title: string };

// "Dizilim → Gerçek Kitap" (proje sidebar'ı): /projects/[id] altındaki alt
// sayfalara (Dizilim, Oku, ...) önceden kalıcı bir giriş noktası yoktu -
// sadece RunStatusView.tsx'teki iki bağlamsal buton vardı. Ayrı bir ikinci
// sidebar kurmak yerine (bu uygulamanın zaten "Arayüz yenileme" fazında
// kurulmuş tek, ChatGPT/Claude-tarzı AppSidebar'ı var), bu mevcut sidebar'a
// proje rotasındayken görünen bağlamsal bir grup eklendi. Hedef sayfaların
// kendisi (dizilim/page.tsx, read/[bookType]/page.tsx) zaten run
// tamamlanmamışsa kendi uyarısını gösteriyor - bu yüzden linkler burada
// devre dışı bırakılmıyor, mevcut "direkt URL ile erişilebilir, sayfa kendi
// korumasını yapar" deseni korunuyor.
const PROJECT_ID_PATTERN = /^\/projects\/([^/]+)/;

export function AppSidebar() {
  const pathname = usePathname();
  const [allProjects, setAllProjects] = useState<RecentProject[] | null>(null);
  const [recentStories, setRecentStories] = useState<RecentStory[] | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => setAllProjects(data.projects ?? []))
      .catch(() => setAllProjects([]));
    fetch("/api/studio/projects")
      .then((res) => res.json())
      .then((data) => setRecentStories((data.storyProjects ?? []).slice(0, 6)))
      .catch(() => setRecentStories([]));
  }, [pathname]);

  const recentProjects = allProjects?.slice(0, 6) ?? null;

  const projectIdMatch = pathname?.match(PROJECT_ID_PATTERN);
  const currentProjectId = projectIdMatch && projectIdMatch[1] !== "new" ? projectIdMatch[1] : null;
  const currentProject = currentProjectId ? (allProjects?.find((p) => p.id === currentProjectId) ?? null) : null;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="text-sidebar-primary" render={<Link href="/projects" />}>
              <span className="flex size-6 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                K
              </span>
              <span className="font-semibold">Kitap Orkestrası</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href || pathname?.startsWith(item.href + "/")}
                    render={<Link href={item.href} />}
                  >
                    {item.label}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground"
                  render={<Link href="/projects/new" />}
                >
                  + Yeni Kitap
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {currentProjectId && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="truncate">{currentProject?.name ?? "Bu proje"}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === `/projects/${currentProjectId}`}
                      render={<Link href={`/projects/${currentProjectId}`} />}
                    >
                      Genel Bakış
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === `/projects/${currentProjectId}/dizilim`}
                      render={<Link href={`/projects/${currentProjectId}/dizilim`} />}
                    >
                      Dizilim
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname?.startsWith(`/projects/${currentProjectId}/read/`) ?? false}
                      render={<Link href={`/projects/${currentProjectId}/read/student_book`} />}
                    >
                      Oku
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Son Projeler</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {recentProjects === null &&
                Array.from({ length: 3 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton />
                  </SidebarMenuItem>
                ))}
              {recentProjects?.length === 0 && (
                <SidebarMenuItem>
                  <span className="px-2 text-xs text-sidebar-foreground/50">Henüz proje yok</span>
                </SidebarMenuItem>
              )}
              {recentProjects?.map((p) => (
                <SidebarMenuItem key={p.id}>
                  <SidebarMenuButton
                    isActive={pathname === `/projects/${p.id}`}
                    render={<Link href={`/projects/${p.id}`} title={p.name} />}
                  >
                    <span className="truncate">{p.name}</span>
                    {p.latestRun && AWAITING_STATUSES.has(p.latestRun.status) && (
                      <span
                        className="ml-auto size-1.5 shrink-0 rounded-full bg-amber-500"
                        title={STATUS_LABELS[p.latestRun.status]}
                      />
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Son Hikayeler</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {recentStories === null &&
                Array.from({ length: 2 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton />
                  </SidebarMenuItem>
                ))}
              {recentStories?.length === 0 && (
                <SidebarMenuItem>
                  <span className="px-2 text-xs text-sidebar-foreground/50">Henüz hikaye yok</span>
                </SidebarMenuItem>
              )}
              {recentStories?.map((s) => (
                <SidebarMenuItem key={s.id}>
                  <SidebarMenuButton
                    isActive={pathname === `/studio/${s.id}`}
                    render={<Link href={`/studio/${s.id}`} title={s.title} />}
                  >
                    <span className="truncate">{s.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <UserButton />
              <span className="text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">Hesabım</span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
