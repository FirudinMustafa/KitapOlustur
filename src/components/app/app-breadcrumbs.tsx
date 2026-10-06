"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { BOOK_TYPE_LABELS } from "@/lib/run-status";

type Crumb = { href: string; label: string };

// Header breadcrumbs derived purely from the pathname. Dynamic ids get a
// generic label ("Proje", "Hikaye") - the page itself shows the real name in
// its PageHeader, so the header doesn't need an extra fetch per navigation.
function crumbsFor(pathname: string): Crumb[] {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return [{ href: "/", label: "Ana sayfa" }];

  const crumbs: Crumb[] = [];
  const [root, id, sub, subId] = parts;

  if (root === "projects") {
    crumbs.push({ href: "/projects", label: "Kitap Projeleri" });
    if (id === "new") crumbs.push({ href: "/projects/new", label: "Yeni kitap" });
    else if (id) {
      crumbs.push({ href: `/projects/${id}`, label: "Proje" });
      if (sub === "dizilim" || sub === "layout") crumbs.push({ href: `/projects/${id}/dizilim`, label: "Dizilim" });
      if (sub === "read")
        crumbs.push({
          href: pathname,
          label: subId ? `Oku · ${BOOK_TYPE_LABELS[subId] ?? subId}` : "Oku",
        });
    }
  } else if (root === "studio") {
    crumbs.push({ href: "/studio", label: "Hikaye Stüdyosu" });
    if (id) crumbs.push({ href: `/studio/${id}`, label: "Hikaye" });
  } else if (root === "search") {
    crumbs.push({ href: "/search", label: "Ara" });
  }
  return crumbs;
}

export function AppBreadcrumbs() {
  const pathname = usePathname() ?? "/";
  const crumbs = crumbsFor(pathname);
  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={crumb.href + i}>
              {i > 0 && <BreadcrumbSeparator className="max-sm:hidden" />}
              <BreadcrumbItem className={last ? "min-w-0" : "max-sm:hidden"}>
                {last ? (
                  <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
