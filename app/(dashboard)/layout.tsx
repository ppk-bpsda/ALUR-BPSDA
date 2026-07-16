import Sidebar from "@/components/Sidebar";
import AccountMenu from "@/components/AccountMenu";
import { createClient } from "@/lib/supabase/server";
import { getPeriode, tahapanLabel } from "@/lib/periode";
import { Bell, Search } from "lucide-react";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { tahun, tahapan } = getPeriode();
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName = "Admin";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, nama")
      .eq("id", user.id)
      .maybeSingle();
    displayName = profile?.nama || profile?.username || user.email?.split("@")[0] || "Admin";
  }
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "AD";

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <div className="hidden sm:flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5 w-72">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              className="bg-transparent text-sm outline-none w-full placeholder:text-slate-400"
              placeholder="Cari nomor bukti, kegiatan..."
            />
          </div>
          <div className="flex items-center gap-4">
            <Bell className="h-5 w-5 text-slate-400" />
            <AccountMenu
              displayName={displayName}
              initials={initials}
              tahun={tahun}
              tahapanLabel={tahapanLabel(tahapan)}
            />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
