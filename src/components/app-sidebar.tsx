"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { UserButton } from "@clerk/nextjs";

// False during the server render and hydration, true afterwards.
const noopSubscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
import {
  BookMarkedIcon,
  BookOpenTextIcon,
  ColumnsIcon,
  LayoutDashboardIcon,
  LibraryBigIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";
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
import { StatusDot } from "@/components/app/status-badge";
import { ThemeToggle } from "@/components/app/theme-toggle";

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
  { href: "/projects", label: "Kitap Projeleri", Icon: LibraryBigIcon },
  { href: "/studio", label: "Hikaye Stüdyosu", Icon: SparklesIcon },
  { href: "/search", label: "Ara", Icon: SearchIcon },
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
  const hydrated = useHydrated();
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
            <SidebarMenuButton size="lg" tooltip="Kitap Orkestrası" render={<Link href="/" />}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sidebar-primary to-warm font-heading text-lg leading-none text-sidebar-primary-foreground shadow-sm">
                K
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-heading text-[15px] font-medium">Kitap Orkestrası</span>
                <span className="truncate text-[11px] text-sidebar-foreground/60">AI kitap atölyesi</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="mb-1">
                <SidebarMenuButton
                  tooltip="Yeni kitap"
                  className="bg-sidebar-primary text-sidebar-primary-foreground shadow-sm hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground active:bg-sidebar-primary/90 active:text-sidebar-primary-foreground"
                  render={<Link href="/projects/new" />}
                >
                  <PlusIcon />
                  <span>Yeni kitap</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {NAV_ITEMS.map(({ href, label, Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    tooltip={label}
                    isActive={(pathname === href || pathname?.startsWith(href + "/")) && pathname !== "/projects/new"}
                    render={<Link href={href} />}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
                      tooltip="Genel bakış"
                      render={<Link href={`/projects/${currentProjectId}`} />}
                    >
                      <LayoutDashboardIcon />
                      <span>Genel bakış</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === `/projects/${currentProjectId}/dizilim`}
                      tooltip="Dizilim"
                      render={<Link href={`/projects/${currentProjectId}/dizilim`} />}
                    >
                      <ColumnsIcon />
                      <span>Dizilim</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname?.startsWith(`/projects/${currentProjectId}/read/`) ?? false}
                      tooltip="Oku"
                      render={<Link href={`/projects/${currentProjectId}/read`} />}
                    >
                      <BookOpenTextIcon />
                      <span>Oku</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        <SidebarSeparator />

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Son projeler</SidebarGroupLabel>
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
                    <BookMarkedIcon className="text-sidebar-foreground/50" />
                    <span className="truncate">{p.name}</span>
                    {p.latestRun && p.latestRun.status !== "done" && (
                      <StatusDot status={p.latestRun.status} className="ml-auto" />
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Son hikayeler</SidebarGroupLabel>
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
                    <SparklesIcon className="text-sidebar-foreground/50" />
                    <span className="truncate">{s.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2">
        <ThemeToggle className="px-0.5 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center" />
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              {/* Clerk's button renders differently on the server and the client;
                  the hydration error that caused made React rebuild the whole
                  page and wipe whatever the user had already typed into a form
                  (live test 2026-10-12). Drawn only after hydration. */}
              <span className="flex size-7 shrink-0 items-center justify-center">{hydrated ? <UserButton /> : null}</span>
              <span className="text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">Hesabım</span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
