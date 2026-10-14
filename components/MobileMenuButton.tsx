"use client";

import { Menu } from "lucide-react";

export default function MobileMenuButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("toggle-sidebar"))}
      className="lg:hidden h-9 w-9 -ml-1 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
      aria-label="Buka menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
