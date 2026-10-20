"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FocusEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { LogOut, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { logout } from "@/app/login/actions";
import { isActive, navGroups } from "./nav-config";
import { cn } from "./ui/cn";

// Status ciut disimpan di cookie (preferensi tampilan saja, bukan data sensitif) agar
// server bisa merender lebar yang benar sejak awal -- tanpa kedipan saat halaman dimuat.
const COOKIE = "alur_sidebar";
const RAIL_WIDTH = 72; // px, = lg:w-[4.5rem]

const rowBase =
  "group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[13px] transition-colors duration-fast lg:py-2.5";

export default function Sidebar({ defaultCollapsed = false }: { defaultCollapsed?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false); // drawer (ponsel/tablet)
  const [collapsed, setCollapsed] = useState(defaultCollapsed); // rail (desktop)
  const [tip, setTip] = useState<{ text: string; top: number } | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const touchStartX = useRef<number | null>(null);

  // Tombol menu di header mengirim event ini.
  useEffect(() => {
    const toggle = () => setOpen((v) => !v);
    window.addEventListener("toggle-sidebar", toggle);
    return () => window.removeEventListener("toggle-sidebar", toggle);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  // Drawer terbuka: kunci gulir, Esc menutup, fokus masuk ke drawer lalu kembali ke pemicu.
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    asideRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // Bila layar melebar ke desktop saat drawer terbuka, tutup agar gulir tidak terkunci.
    const mq = window.matchMedia("(min-width: 1024px)");
    const onMq = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onMq);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
      document.body.style.overflow = prevOverflow;
      trigger?.focus?.();
    };
  }, [open]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    setTip(null);
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax${secure}`;
  }

  // Tooltip untuk rail: dirender lewat portal agar tidak terpotong overflow sidebar.
  function showTip(e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>, text: string) {
    if (!collapsed || !window.matchMedia("(min-width: 1024px)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ text, top: r.top + r.height / 2 });
  }
  const hideTip = () => setTip(null);
  const tipProps = (text: string) => ({
    onMouseEnter: (e: MouseEvent<HTMLElement>) => showTip(e, text),
    onFocus: (e: FocusEvent<HTMLElement>) => showTip(e, text),
    onMouseLeave: hideTip,
    onBlur: hideTip,
  });

  const labelClass = collapsed ? "lg:sr-only" : undefined;
  const centered = collapsed ? "lg:justify-center lg:px-0" : undefined;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 animate-fade-in bg-ink-950/55 backdrop-blur-[2px] lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        ref={asideRef}
        tabIndex={-1}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          // Geser ke kiri untuk menutup drawer.
          if (touchStartX.current !== null && touchStartX.current - e.changedTouches[0].clientX > 60) setOpen(false);
          touchStartX.current = null;
        }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-[18rem] shrink-0 flex-col text-white outline-none",
          "bg-ink-900 bg-[radial-gradient(90%_45%_at_0%_0%,rgba(47,143,128,0.30),transparent_70%)]",
          "transition-[transform,width] duration-slow ease-out-soft lg:static lg:translate-x-0 lg:transition-[width]",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-[4.5rem]" : "lg:w-64",
        )}
      >
        <div className={cn("flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.07] px-5", collapsed && "lg:justify-center lg:px-0")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-white/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="ALUR-BPSDA" width={36} height={36} className="object-cover" />
          </div>
          <div className={cn("min-w-0 flex-1 leading-tight", collapsed && "lg:hidden")}>
            <p className="text-[13px] font-bold tracking-[0.16em] text-accent-300">ALUR-BPSDA</p>
            <p className="truncate text-xs text-slate-400">SPJ Sekretariat Daerah</p>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition-colors duration-fast hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Menu utama" className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {navGroups.map((group, gi) => (
            <div key={group.label}>
              <p className={cn("mb-2 px-3 text-xs font-semibold tracking-wide text-slate-400", collapsed && "lg:hidden")}>
                {group.label}
              </p>
              {collapsed && gi > 0 && <div className="mx-3 mb-2 hidden h-px bg-white/10 lg:block" aria-hidden="true" />}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      {...tipProps(item.name)}
                      className={cn(
                        rowBase,
                        centered,
                        active ? "bg-white/10 font-semibold text-white" : "text-slate-300 hover:bg-white/[0.06] hover:text-white",
                      )}
                    >
                      {active && (
                        <span aria-hidden="true" className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent-400" />
                      )}
                      <item.icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-colors duration-fast",
                          active ? "text-accent-300" : "text-slate-400 group-hover:text-slate-200",
                        )}
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                      <span className={cn("leading-snug", labelClass)}>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-0.5 border-t border-white/[0.07] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-pressed={collapsed}
            {...tipProps(collapsed ? "Perluas menu" : "Ciutkan menu")}
            className={cn(rowBase, "hidden text-slate-300 hover:bg-white/[0.06] hover:text-white lg:flex", centered)}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-[18px] w-[18px] shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px] shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden="true" />
            )}
            <span className={labelClass}>{collapsed ? "Perluas menu" : "Ciutkan menu"}</span>
          </button>
          <form action={logout}>
            <button
              type="submit"
              {...tipProps("Keluar")}
              className={cn(rowBase, "text-slate-300 hover:bg-danger-600/20 hover:text-white", centered)}
            >
              <LogOut className="h-[18px] w-[18px] shrink-0 text-slate-400 group-hover:text-danger-200" strokeWidth={1.75} aria-hidden="true" />
              <span className={labelClass}>Keluar</span>
            </button>
          </form>
        </div>
      </aside>

      {tip &&
        createPortal(
          <div
            role="tooltip"
            style={{ top: tip.top, left: RAIL_WIDTH + 8 }}
            className="pointer-events-none fixed z-[70] -translate-y-1/2 animate-fade-in whitespace-nowrap rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lift ring-1 ring-white/10"
          >
            {tip.text}
          </div>,
          document.body,
        )}
    </>
  );
}
