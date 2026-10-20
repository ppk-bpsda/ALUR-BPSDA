"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";

export interface TabItem {
  id: string;
  label: string;
  /** Angka kecil di samping label (mis. jumlah data). */
  count?: number;
  content: ReactNode;
}

/**
 * Tab aksesibel (role tablist/tab/tabpanel), navigasi panah kiri/kanan + Home/End.
 * Tanpa `value`, komponen mengelola sendiri tab aktif.
 */
export function Tabs({
  items,
  defaultId,
  value,
  onChange,
  label,
  className,
}: {
  items: TabItem[];
  defaultId?: string;
  value?: string;
  onChange?: (id: string) => void;
  /** Nama daftar tab untuk pembaca layar. */
  label: string;
  className?: string;
}) {
  const base = useId();
  const [inner, setInner] = useState(defaultId ?? items[0]?.id);
  const active = value ?? inner;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function select(id: string) {
    if (value === undefined) setInner(id);
    onChange?.(id);
  }

  function onKeyDown(e: KeyboardEvent, index: number) {
    const last = items.length - 1;
    let next = -1;
    if (e.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next < 0) return;
    e.preventDefault();
    select(items[next].id);
    refs.current[next]?.focus();
  }

  const current = items.find((i) => i.id === active);

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-100/80 p-1"
      >
        {items.map((t, i) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-base ease-out-soft",
                selected ? "bg-white text-ink-900 shadow-soft" : "text-slate-500 hover:text-ink-900",
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    selected ? "bg-accent-300 text-ink-900" : "bg-slate-200 text-slate-600",
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {current && (
        <div
          role="tabpanel"
          id={`${base}-panel-${current.id}`}
          aria-labelledby={`${base}-tab-${current.id}`}
          tabIndex={0}
          className="mt-4 animate-fade-in focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          {current.content}
        </div>
      )}
    </div>
  );
}
