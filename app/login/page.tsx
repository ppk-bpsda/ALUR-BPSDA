import { login } from "./actions";
import { ShieldCheck, User, Lock, ChevronRight, CalendarRange, Layers } from "lucide-react";
import { TAHUN_OPTIONS, TAHAPAN_OPTIONS } from "@/lib/periode";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="min-h-screen w-full bg-slate-900 relative overflow-hidden flex items-center justify-center px-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-amber-400" />
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-800 opacity-30 blur-3xl" />
      <div className="absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-amber-700 opacity-20 blur-3xl" />

      <div className="relative w-full max-w-4xl grid md:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-slate-700">
        <div className="hidden md:flex flex-col justify-between bg-slate-800 p-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-emerald-600 flex items-center justify-center ring-2 ring-amber-400">
                <ShieldCheck className="h-6 w-6 text-white" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-xs tracking-widest text-amber-400 font-medium">PEMERINTAH KOTA BATU</p>
                <p className="text-slate-100 text-sm font-serif">Sekretariat Daerah</p>
              </div>
            </div>
            <h1 className="mt-14 font-serif text-3xl leading-tight text-white">
              Sistem Administrasi
              <br />
              Penyusunan SPJ
            </h1>
            <p className="mt-4 text-sm text-slate-400 leading-relaxed max-w-xs">
              Satu tempat untuk mengelola pagu anggaran, menyusun Nota Dinas, SPP/SPTJB,
              dan Kwitansi GU secara konsisten dan tercatat rapi.
            </p>
          </div>
          <div className="text-xs text-slate-500 font-mono">Tahun Anggaran 2026 &amp; seterusnya</div>
        </div>

        <div className="bg-white p-10 flex flex-col justify-center">
          <p className="text-xs tracking-widest text-slate-400 font-medium mb-1">MASUK</p>
          <h2 className="font-serif text-2xl text-slate-900 mb-1">Login Admin</h2>
          <p className="text-sm text-slate-500 mb-8">Akses aplikasi ini terbatas untuk akun Admin.</p>

          {searchParams?.error && (
            <div className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {searchParams.error}
            </div>
          )}

          <form action={login}>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Username</label>
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 mb-4 focus-within:ring-2 focus-within:ring-emerald-200 focus-within:border-emerald-500">
              <User className="h-4 w-4 text-slate-400" />
              <input
                name="username"
                type="text"
                required
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full text-sm outline-none placeholder:text-slate-400"
                placeholder="mis. admin1"
              />
            </div>

            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Kata Sandi</label>
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 mb-4 focus-within:ring-2 focus-within:ring-emerald-200 focus-within:border-emerald-500">
              <Lock className="h-4 w-4 text-slate-400" />
              <input
                name="password"
                type="password"
                required
                className="w-full text-sm outline-none placeholder:text-slate-400"
                placeholder="••••••••"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">Tahun Anggaran</label>
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-emerald-200 focus-within:border-emerald-500">
                  <CalendarRange className="h-4 w-4 text-slate-400 shrink-0" />
                  <select name="tahun_anggaran" required defaultValue={TAHUN_OPTIONS[0]} className="w-full text-sm outline-none bg-transparent">
                    {TAHUN_OPTIONS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">Tahapan</label>
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-emerald-200 focus-within:border-emerald-500">
                  <Layers className="h-4 w-4 text-slate-400 shrink-0" />
                  <select name="tahapan" required defaultValue="murni" className="w-full text-sm outline-none bg-transparent">
                    {TAHAPAN_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 transition-colors text-white text-sm font-medium rounded-lg py-2.5 flex items-center justify-center gap-2"
            >
              Masuk <ChevronRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-6 text-xs text-slate-400 leading-relaxed">
            Lupa kata sandi? Hubungi administrator sistem. Tahun Anggaran &amp; Tahapan yang
            dipilih akan jadi periode aktif di seluruh aplikasi selama sesi ini -- bisa
            diganti lagi lewat menu "Ganti Periode" di sidebar.
          </p>
        </div>
      </div>
    </div>
  );
}
