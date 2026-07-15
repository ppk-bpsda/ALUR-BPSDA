import { createClient } from "@/lib/supabase/server";
import { addAkun, deleteAkun } from "./actions";
import { Trash2, UserCircle2 } from "lucide-react";

export default async function AkunPage() {
  const supabase = createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, nama, created_at")
    .order("created_at", { ascending: true });

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-serif text-xl text-slate-900">Manajemen Akun</h1>
        <p className="text-sm text-slate-500">
          Tambah akun lain yang membutuhkan akses untuk proses administrasi. Semua akun
          punya akses penuh yang sama seperti akun ini.
        </p>
      </div>

      <form action={addAkun} className="bg-white rounded-xl border border-slate-200 p-5 grid sm:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Username</label>
          <input
            name="username"
            required
            placeholder="mis. staf1"
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Nama</label>
          <input
            name="nama"
            placeholder="Nama lengkap"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Kata Sandi</label>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="minimal 6 karakter"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
          />
        </div>
        <div className="sm:col-span-3">
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            + Tambah Akun
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="font-medium px-5 py-2.5">Username</th>
              <th className="font-medium px-5 py-2.5">Nama</th>
              <th className="font-medium px-5 py-2.5">Dibuat</th>
              <th className="font-medium px-5 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p: any) => (
              <tr key={p.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 text-slate-700 flex items-center gap-2">
                  <UserCircle2 className="h-4 w-4 text-slate-400" />
                  {p.username}
                  {p.id === currentUser?.id && (
                    <span className="text-[10px] uppercase tracking-wide bg-emerald-50 text-emerald-700 rounded px-1.5 py-0.5">
                      Anda
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-500">{p.nama || "-"}</td>
                <td className="px-5 py-3 text-slate-400 text-xs">
                  {new Date(p.created_at).toLocaleDateString("id-ID")}
                </td>
                <td className="px-5 py-3 text-right">
                  {p.id !== currentUser?.id && (
                    <form action={deleteAkun}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="text-rose-500 hover:text-rose-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
