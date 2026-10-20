"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { CalendarRange, ChevronDown, LogOut, Users } from "lucide-react";
import { logout } from "@/app/login/actions";
import { cn } from "./ui/cn";

const itemClass =
  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-slate-600 outline-none transition-colors duration-fast hover:bg-slate-50 focus-visible:bg-slate-100";

export default function AccountMenu({
  displayName,
  initials,
  tahun,
  tahapanLabel,
}: {
  displayName: string;
  initials: string;
  tahun: number;
  tahapanLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    items()[0]?.focus();

    const onMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
        return;
      }
      if (e.key === "Tab") {
        setOpen(false);
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
      const list = items();
      if (list.length === 0) return;
      e.preventDefault();
      const cur = list.indexOf(document.activeElement as HTMLElement);
      let next = cur;
      if (e.key === "ArrowDown") next = (cur + 1) % list.length;
      if (e.key === "ArrowUp") next = (cur - 1 + list.length) % list.length;
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = list.length - 1;
      list[next].focus();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Menu akun ${displayName}`}
        className="flex h-10 items-center gap-2 rounded-xl px-1.5 transition-colors duration-fast hover:bg-slate-100 sm:h-auto sm:py-1"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white shadow-soft ring-2 ring-white">
          {initials}
        </span>
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-slate-700 sm:block">{displayName}</span>
        <ChevronDown
          className={cn("hidden h-3.5 w-3.5 text-slate-400 transition-transform duration-base sm:block", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Menu akun"
          className="absolute right-0 z-50 mt-2 w-64 origin-top-right animate-scale-in rounded-2xl border border-line bg-white p-1.5 shadow-lift"
        >
          <div className="border-b border-line px-3 pb-2.5 pt-2">
            <p className="text-sm font-semibold text-ink-900">{displayName}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
              Tahun {tahun} &middot; Tahapan {tahapanLabel}
            </p>
          </div>
          <div className="pt-1.5">
            <Link href="/periode" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
              <CalendarRange className="h-4 w-4 text-slate-400" aria-hidden="true" /> Ganti Periode
            </Link>
            <Link href="/akun" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
              <Users className="h-4 w-4 text-slate-400" aria-hidden="true" /> Akses Aplikasi (Login)
            </Link>
            <form action={logout} role="none">
              <button
                type="submit"
                role="menuitem"
                className={cn(itemClass, "text-danger-600 hover:bg-danger-50 focus-visible:bg-danger-50")}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" /> Keluar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
