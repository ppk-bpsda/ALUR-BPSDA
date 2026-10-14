import { redirect } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import AccountMenu from "@/components/AccountMenu";
import FlashBanner from "@/components/FlashBanner";
import MobileMenuButton from "@/components/MobileMenuButton";
import { getCurrentProfile } from "@/lib/session";
import { getPeriode, tahapanLabel } from "@/lib/periode";
import { CalendarRange } from "lucide-react";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Dua pekerjaan ini tidak saling bergantung -> jalankan bersamaan.
  const [{ tahun, tahapan }, profile] = await Promise.all([getPeriode(), getCurrentProfile()]);

  // Verifikasi otoritatif (getUser) -- middleware hanya memeriksa cookie lokal.
  if (!profile) redirect("/login");

  return (
    <div className="flex h-screen bg-[#f4f6f8] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/90 backdrop-blur border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 shrink-0 relative z-20">
          <div className="flex items-center gap-2">
            <MobileMenuButton />
            <Link
              href="/periode"
              className="hidden sm:inline-flex items-center gap-2 rounded-full bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100 px-3 py-1.5 text-xs font-medium hover:bg-brand-100 transition-colors"
              title="Ganti periode"
            >
              <CalendarRange className="h-3.5 w-3.5" />
              TA {tahun} &middot; {tahapanLabel(tahapan)}
            </Link>
          </div>
          <AccountMenu
            displayName={profile.displayName}
            initials={profile.initials}
            tahun={tahun}
            tahapanLabel={tahapanLabel(tahapan)}
          />
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl animate-fade-up">
            <FlashBanner />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
