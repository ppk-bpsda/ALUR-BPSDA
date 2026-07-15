import Sidebar from "@/components/Sidebar";
import { Bell, Search } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-medium">
                AD
              </div>
              <span className="text-sm text-slate-600 hidden sm:block">Admin</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
