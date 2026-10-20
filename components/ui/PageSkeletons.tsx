import { Skeleton } from "./Feedback";

// Kerangka pemuat yang meniru bentuk halaman sebenarnya, dipakai oleh loading.tsx.
function Shell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="space-y-6" aria-busy="true" role="status">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function HeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {withAction && <Skeleton className="h-10 w-36 rounded-ctl" />}
    </div>
  );
}

function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex gap-4 border-b border-line bg-surface-muted px-4 py-3.5">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-line px-4 py-4 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={c === 0 ? "h-4 w-24 shrink-0" : "h-4 flex-1"} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Dashboard: banner + 4 kartu KPI + grafik/tabel. */
export function DashboardSkeleton() {
  return (
    <Shell label="Memuat dashboard…">
      <Skeleton className="h-24 w-full rounded-card" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-card" />
    </Shell>
  );
}

/** Halaman daftar: judul + filter + tabel. */
export function ListPageSkeleton() {
  return (
    <Shell label="Memuat daftar…">
      <HeaderSkeleton />
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-64 max-w-full rounded-ctl" />
        <Skeleton className="h-10 w-40 rounded-ctl" />
        <Skeleton className="h-10 w-40 rounded-ctl" />
      </div>
      <TableSkeleton />
    </Shell>
  );
}

/** Halaman formulir: judul + beberapa kartu isian. */
export function FormPageSkeleton() {
  return (
    <Shell label="Memuat formulir…">
      <HeaderSkeleton withAction={false} />
      {[0, 1].map((i) => (
        <div key={i} className="card space-y-4 p-6">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-10 w-full rounded-ctl" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Skeleton className="h-48 w-full rounded-card" />
    </Shell>
  );
}

/** Rekap/laporan: judul + tab + tabel. */
export function ReportSkeleton() {
  return (
    <Shell label="Memuat laporan…">
      <HeaderSkeleton />
      <Skeleton className="h-11 w-full max-w-md rounded-2xl" />
      <TableSkeleton rows={10} cols={6} />
    </Shell>
  );
}

/** Pengaturan/periode: judul + satu-dua kartu pengaturan. */
export function SettingsSkeleton() {
  return (
    <Shell label="Memuat pengaturan…">
      <HeaderSkeleton withAction={false} />
      {[0, 1].map((i) => (
        <div key={i} className="card space-y-4 p-6">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full max-w-lg" />
          <Skeleton className="h-10 w-full max-w-sm rounded-ctl" />
        </div>
      ))}
    </Shell>
  );
}
