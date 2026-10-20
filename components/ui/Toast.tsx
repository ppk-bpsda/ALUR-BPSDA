"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "./cn";

type Tone = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
  title?: string;
}

interface ToastOptions {
  title?: string;
  /** milidetik; 0 = tidak hilang otomatis */
  duration?: number;
}

interface ToastApi {
  success: (message: string, opts?: ToastOptions) => void;
  error: (message: string, opts?: ToastOptions) => void;
  warning: (message: string, opts?: ToastOptions) => void;
  info: (message: string, opts?: ToastOptions) => void;
  dismiss: (id: number) => void;
}

const Ctx = createContext<ToastApi | null>(null);

const STYLE: Record<Tone, { box: string; icon: typeof Info; iconClass: string }> = {
  success: { box: "border-success-200", icon: CheckCircle2, iconClass: "text-success-600" },
  error: { box: "border-danger-200", icon: AlertCircle, iconClass: "text-danger-600" },
  warning: { box: "border-warning-200", icon: AlertTriangle, iconClass: "text-warning-600" },
  info: { box: "border-info-200", icon: Info, iconClass: "text-info-600" },
};

const MAX_VISIBLE = 4;

/** Pengganti window.alert(). Pasang sekali di layout root; panggil lewat useToast(). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (tone: Tone, message: string, opts?: ToastOptions) => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, tone, message, title: opts?.title }]);
      const duration = opts?.duration ?? (tone === "error" ? 7000 : 4500);
      if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, o) => push("success", m, o),
      error: (m, o) => push("error", m, o),
      warning: (m, o) => push("warning", m, o),
      info: (m, o) => push("info", m, o),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        role="region"
        aria-label="Notifikasi"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:items-end"
      >
        {items.map((t) => {
          const s = STYLE[t.tone];
          const Icon = s.icon;
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm animate-slide-in-right items-start gap-3 rounded-2xl border bg-white p-3.5 shadow-lift",
                s.box,
              )}
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", s.iconClass)} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                {t.title && <p className="text-sm font-semibold text-ink-900">{t.title}</p>}
                <p className={cn("text-sm text-slate-600", !t.title && "text-ink-800")}>{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Tutup notifikasi"
                className="rounded-lg p-1 text-slate-400 transition-colors duration-fast hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast harus dipakai di dalam <ToastProvider> (sudah dipasang di app/layout.tsx).");
  return ctx;
}
