import type { ReactNode } from "react";
import { Banknote, CheckCircle2, Pencil, Send, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "accent";

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  success: "bg-success-50 text-success-700 ring-success-200",
  warning: "bg-warning-50 text-warning-700 ring-warning-200",
  danger: "bg-danger-50 text-danger-700 ring-danger-200",
  info: "bg-info-50 text-info-700 ring-info-200",
  accent: "bg-accent-300 text-ink-900 ring-accent-500/40",
};

export function Badge({
  tone = "neutral",
  icon: Icon,
  className,
  children,
}: {
  tone?: BadgeTone;
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE[tone],
        className,
      )}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** SATU-SATUNYA sumber label, warna, dan ikon status pengajuan. */
export const STATUS_META: Record<
  string,
  { label: string; tone: BadgeTone; icon: LucideIcon }
> = {
  draft: { label: "Draft", tone: "neutral", icon: Pencil },
  diajukan: { label: "Diajukan", tone: "warning", icon: Send },
  disetujui: { label: "Disetujui", tone: "success", icon: CheckCircle2 },
  dicairkan: { label: "Dicairkan", tone: "info", icon: Banknote },
  ditolak: { label: "Ditolak", tone: "danger", icon: XCircle },
};

/** Status dibedakan lewat warna DAN ikon + teks (tidak hanya warna). */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <Badge tone={meta.tone} icon={meta.icon} className={className}>
      {meta.label}
    </Badge>
  );
}
