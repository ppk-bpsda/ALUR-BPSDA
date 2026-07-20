"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarRange, LogOut, Users, ChevronDown } from "lucide-react";
import { logout } from "@/app/login/actions";

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-100 transition-colors"
      >
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-emerald-600 text-white text-xs flex items-center justify-center font-medium shrink-0">
          {initials}
        </div>
        <span className="text-sm text-slate-600 hidden sm:block">{displayName}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-lg py-2 z-50">
          <div className="px-4 py-2 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-900">{displayName}</p>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <CalendarRange className="h-3.5 w-3.5" />
              Tahun {tahun} -- Tahapan {tahapanLabel}
            </p>
          </div>
          <Link
            href="/periode"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <CalendarRange className="h-4 w-4" /> Ganti Periode
          </Link>
          <Link
            href="/akun"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Users className="h-4 w-4" /> Akses Aplikasi (Login)
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" /> Keluar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
