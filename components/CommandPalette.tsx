"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search, type LucideIcon } from "lucide-react";
import { extraCommands, navGroups } from "./nav-config";
import { cn } from "./ui/cn";

interface Cmd {
  name: string;
  href: string;
  hint: string;
  icon: LucideIcon;
  keywords: string;
}

const COMMANDS: Cmd[] = [
  ...navGroups.flatMap((g) =>
    g.items.map((i) => ({ name: i.name, href: i.href, hint: g.label, icon: i.icon, keywords: i.keywords ?? "" })),
  ),
  ...extraCommands,
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Pencarian cepat halaman/tindakan: Ctrl+K (Windows/Linux) atau Cmd+K (Mac). Hanya navigasi, tanpa data. */
export default function CommandPalette() {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [mac, setMac] = useState(false);

  useEffect(() => {
    setMounted(true);
    setMac(/Mac|iPhone|iPad/.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const tokens = norm(query).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return COMMANDS;
    return COMMANDS.filter((c) => {
      const hay = norm(`${c.name} ${c.hint} ${c.keywords}`);
      return tokens.every((t) => hay.includes(t));
    });
  }, [query]);

  useEffect(() => setIndex(0), [query]);

  // Saat terbuka: kunci gulir, fokus ke kolom cari, Esc menutup, fokus kembali ke pemicu.
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      setQuery("");
      trigger?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${index}`)?.scrollIntoView({ block: "nearest" });
  }, [index, open, listId]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && results[index]) {
      e.preventDefault();
      go(results[index].href);
    } else if (e.key === "Tab") {
      e.preventDefault(); // dialog hanya punya satu kontrol yang bisa difokus
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label="Cari halaman"
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-transparent px-2.5 text-sm text-slate-500 transition-colors duration-fast hover:bg-slate-100 md:h-9 md:border-line-strong md:bg-white md:hover:border-slate-300"
      >
        <Search className="h-[18px] w-[18px] md:h-4 md:w-4" aria-hidden="true" />
        <span className="hidden md:inline">Cari halaman…</span>
        <kbd className="hidden rounded-md border border-line bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-slate-500 md:inline">
          {mac ? "⌘ K" : "Ctrl K"}
        </kbd>
      </button>

      {open &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh] sm:pt-[15vh]">
            <div className="absolute inset-0 animate-fade-in bg-ink-950/55 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-hidden="true" />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Cari halaman"
              className="relative w-full max-w-lg animate-scale-in overflow-hidden rounded-card bg-white shadow-lift ring-1 ring-black/5"
            >
              <div className="flex items-center gap-3 border-b border-line px-4">
                <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onInputKeyDown}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={results[index] ? `${listId}-${index}` : undefined}
                  aria-label="Cari halaman atau tindakan"
                  placeholder="Cari halaman atau tindakan…"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-12 w-full bg-transparent text-base text-ink-900 outline-none placeholder:text-slate-400 sm:text-sm"
                />
                <kbd className="hidden rounded-md border border-line bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-slate-500 sm:inline">Esc</kbd>
              </div>

              {results.length === 0 ? (
                <p role="status" className="px-4 py-10 text-center text-sm text-slate-500">
                  Tidak ada hasil untuk “{query}”.
                </p>
              ) : (
                <ul id={listId} role="listbox" aria-label="Hasil pencarian" className="max-h-80 overflow-y-auto p-2">
                  {results.map((c, i) => {
                    const active = i === index;
                    return (
                      <li
                        key={`${c.href}-${c.name}`}
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={active}
                        onMouseMove={() => setIndex(i)}
                        onClick={() => go(c.href)}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-fast",
                          active ? "bg-brand-50" : "bg-transparent",
                        )}
                      >
                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500")}>
                          <c.icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink-900">{c.name}</span>
                          <span className="block truncate text-xs text-slate-500">{c.hint}</span>
                        </span>
                        {active && <CornerDownLeft className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />}
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="hidden items-center gap-4 border-t border-line bg-surface-muted px-4 py-2 text-xs text-slate-500 sm:flex">
                <span>↑ ↓ pilih</span>
                <span>Enter buka</span>
                <span>Esc tutup</span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
