"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ROUTE_LABELS } from "./nav-config";
import { cn } from "./ui/cn";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Crumb {
  label: string;
  href?: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) return [{ label: "Dashboard" }];
  const crumbs: Crumb[] = [];
  let acc = "";
  segs.forEach((seg, i) => {
    acc += `/${seg}`;
    const last = i === segs.length - 1;
    if (UUID.test(seg)) {
      // ID di tengah URL (mis. /pengajuan/<id>/edit) dilewati; ID di akhir = halaman rincian.
      if (last) crumbs.push({ label: "Rincian" });
      return;
    }
    const label = ROUTE_LABELS[seg] ?? seg.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
    crumbs.push({ label, href: last ? undefined : acc });
  });
  return crumbs;
}

/** Breadcrumb otomatis dari URL. Di ponsel hanya menampilkan halaman saat ini. */
export default function Breadcrumbs() {
  const crumbs = buildCrumbs(usePathname());
  return (
    <nav aria-label="Navigasi remah roti" className="min-w-0 flex-1">
      <ol className="flex items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className={cn("flex min-w-0 items-center gap-1.5", !last && "hidden sm:flex")}>
              {c.href ? (
                <Link href={c.href} className="truncate rounded text-slate-500 transition-colors duration-fast hover:text-brand-700">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="truncate font-semibold text-ink-900">
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
