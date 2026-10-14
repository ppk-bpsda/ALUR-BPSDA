"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Building2, Wallet, ClipboardList, ShieldCheck,
  FileSpreadsheet, Settings, LogOut, Plane, Users, BadgeDollarSign, X,
} from "lucide-react";
import { logout } from "@/app/login/actions";

const navGroups = [
  { label: "Ringkasan", items: [{ icon: LayoutDashboard, name: "Dashboard", href: "/" }] },
  {
    label: "Transaksi",
    items: [{ icon: ClipboardList, name: "Pengajuan Belanja", href: "/pengajuan" }],
  },
  {
    label: "Administrasi Perjalanan Dinas",
    items: [
      { icon: Plane, name: "Kuitansi SPPD", href: "/perjalanan-dinas" },
      { icon: Users, name: "Data Pegawai", href: "/perjalanan-dinas/pegawai" },
      { icon: BadgeDollarSign, name: "SBU Uang Harian", href: "/perjalanan-dinas/sbu" },
    ],
  },
  {
    label: "Master Data",
    items: [
      { icon: Wallet, name: "Rekening & Pagu (DPA)", href: "/rekening" },
      { icon: ShieldCheck, name: "Manajemen Akun (KPA/PPTK/BPP)", href: "/pejabat" },
      { icon: Building2, name: "Penyedia Barang/Jasa", href: "/penyedia" },
    ],
  },
  {
    label: "Laporan",
    items: [{ icon: FileSpreadsheet, name: "Rekap Realisasi", href: "/rekap" }],
  },
  {
    label: "Lainnya",
    items: [{ icon: Settings, name: "Pengaturan Aplikasi", href: "/pengaturan" }],
  },
];

// Item aktif: cocok persis, atau prefix untuk sub-halaman -- kecuali bila ada
// item lain yang lebih spesifik (mis. /perjalanan-dinas/pegawai).
const allHrefs = navGroups.flatMap((g) => g.items.map((i) => i.href));
function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  if (!pathname.startsWith(href + "/")) return false;
  return !allHrefs.some((h) => h !== href && h.startsWith(href + "/") && (pathname === h || pathname.startsWith(h + "/")));
}

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const toggle = () => setOpen((v) => !v);
    window.addEventListener("toggle-sidebar", toggle);
    return () => window.removeEventListener("toggle-sidebar", toggle);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-[17rem] lg:w-64 bg-ink-900 text-white flex flex-col shrink-0 h-full
          transition-transform duration-200 ease-out ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="h-16 flex items-center gap-3 px-5 border-b border-white/[0.07]">
          <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-white/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="ALUR-BPSDA" width={36} height={36} className="object-cover" />
          </div>
          <div className="leading-tight flex-1 min-w-0">
            <p className="text-[13px] tracking-[0.18em] text-brand-200 font-semibold">ALUR-BPSDA</p>
            <p className="text-[11px] text-slate-400 font-serif truncate">SPJ Sekretariat Daerah</p>
          </div>
          <button
            type="button"
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-6">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-2 text-[10px] tracking-[0.16em] text-slate-500 font-semibold uppercase">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                        active
                          ? "bg-white/[0.09] text-white font-medium"
                          : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r bg-brand-300" />
                      )}
                      <item.icon
                        className={`h-4 w-4 shrink-0 ${active ? "text-brand-300" : ""}`}
                        strokeWidth={1.75}
                      />
                      <span className="text-left leading-snug">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.07]">
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-slate-400 hover:bg-white/[0.05] hover:text-white transition-colors"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} /> Keluar
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
