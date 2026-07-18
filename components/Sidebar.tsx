"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, Building2, Wallet,
  ClipboardList, ShieldCheck, FileSpreadsheet, Settings, LogOut,
} from "lucide-react";
import { logout } from "@/app/login/actions";

const navGroups = [
  { label: "Ringkasan", items: [{ icon: LayoutDashboard, name: "Dashboard", href: "/" }] },
  {
    label: "Transaksi",
    items: [
      { icon: ClipboardList, name: "Pengajuan Belanja", href: "/pengajuan" },
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
    items: [
      { icon: FileSpreadsheet, name: "Rekap Realisasi", href: "/rekap" },
    ],
  },
  {
    label: "Lainnya",
    items: [{ icon: Settings, name: "Pengaturan Aplikasi", href: "/pengaturan" }],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 min-h-screen">
      <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800">
        <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center ring-2 ring-amber-400 shrink-0">
          <ShieldCheck className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-xs tracking-widest text-amber-400">KOTA BATU</p>
          <p className="text-xs text-slate-300 font-serif">SPJ Sekretariat Daerah</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-2 mb-2 text-xs tracking-widest text-slate-500 font-medium">
              {group.label.toUpperCase()}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                      active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    <span className="text-left">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-800">
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <LogOut className="h-4 w-4" /> Keluar
          </button>
        </form>
      </div>
    </aside>
  );
}
