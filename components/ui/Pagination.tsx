import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./cn";

function range(page: number, total: number, siblings: number): Array<number | "…"> {
  const keep = new Set<number>([1, total, page]);
  for (let i = 1; i <= siblings; i++) {
    keep.add(page - i);
    keep.add(page + i);
  }
  const sorted = [...keep].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

/** Paginasi berbasis tautan (cocok untuk server component + searchParams). */
export function Pagination({
  page,
  totalPages,
  hrefFor,
  siblings = 1,
  className,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  siblings?: number;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  const item = "inline-flex h-9 min-w-9 items-center justify-center rounded-ctl px-2 text-sm font-medium transition-colors duration-fast";
  return (
    <nav aria-label="Halaman" className={cn("flex flex-wrap items-center justify-center gap-1", className)}>
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(item, "text-slate-600 hover:bg-slate-100")} aria-label="Halaman sebelumnya">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={cn(item, "cursor-not-allowed text-slate-300")} aria-hidden="true">
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}
      {range(page, totalPages, siblings).map((n, i) =>
        n === "…" ? (
          <span key={`gap-${i}`} className={cn(item, "text-slate-400")} aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={n}
            href={hrefFor(n)}
            aria-current={n === page ? "page" : undefined}
            aria-label={`Halaman ${n}`}
            className={cn(item, n === page ? "bg-brand-600 text-white shadow-soft" : "text-slate-600 hover:bg-slate-100")}
          >
            {n}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={cn(item, "text-slate-600 hover:bg-slate-100")} aria-label="Halaman berikutnya">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={cn(item, "cursor-not-allowed text-slate-300")} aria-hidden="true">
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
