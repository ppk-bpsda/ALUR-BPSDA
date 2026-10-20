"use client";

import { Menu } from "lucide-react";

// Mengirim event "toggle-sidebar" yang didengarkan Sidebar (mekanisme lama dipertahankan).
export default function MobileMenuButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("toggle-sidebar"))}
      className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors duration-fast hover:bg-slate-100 active:scale-95 lg:hidden"
      aria-label="Buka menu"
    >
      <Menu className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
