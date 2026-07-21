import { login } from "./actions";
import { User, Lock, ChevronRight, CalendarRange, Layers, Droplets } from "lucide-react";
import { TAHUN_OPTIONS, TAHAPAN_OPTIONS } from "@/lib/periode";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="min-h-screen w-full bg-slate-950 relative overflow-hidden flex items-center justify-center px-6">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400" />
      <div className="absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-emerald-500 opacity-20 blur-3xl" />
      <div className="absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-blue-500 opacity-25 blur-3xl" />
      <div className="absolute left-1/3 top-1/2 h-72 w-72 rounded-full bg-cyan-400 opacity-10 blur-3xl" />

      <div className="relative w-full max-w-4xl grid md:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
        <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-blue-900 via-blue-800 to-emerald-800 p-10 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 h-56 w-56 rounded-full bg-white/5" />
          <div className="absolute right-16 top-24 h-24 w-24 rounded-full bg-emerald-300/10" />

          <div className="relative">
            <div className="bg-white rounded-2xl p-3 w-fit shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="ALUR-BPSDA" width={132} height={132} className="rounded-lg" />
            </div>

            <h1 className="mt-10 font-serif text-3xl leading-tight text-white">
              Sistem Administrasi
              <br />
              Penyusunan SPJ
            </h1>
            <p className="mt-4 text-sm text-blue-100/80 leading-relaxed max-w-xs">
              Aplikasi Layanan Urusan Realisasi untuk mengelola pagu anggaran, realisasi belanja, 
              menyusun Nota Dinas, SPP/SPTJB, dan Kwitansi dengan metode pembayaran GU dan LS 
              secara konsisten dan tercatat rapi.
            </p>
          </div>

          <div className="relative flex items-center gap-2 text-xs text-emerald-200/80 font-mono">
            <Droplets className="h-3.5 w-3.5" />
            Tahun Anggaran 2026 &amp; seterusnya
          </div>
        </div>

        <div className="bg-white p-10 flex flex-col justify-center">
          <p className="text-xs tracking-widest text-blue-600 font-semibold mb-1">MASUK</p>
          <h2 className="font-serif text-2xl text-slate-900 mb-1">Login Admin</h2>
          <p className="text-sm text-slate-500 mb-8">Akses aplikasi ini terbatas untuk akun Admin.</p>

          {searchParams?.error && (
            <div className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {searchParams.error}
            </div>
          )}

          <form action={login}>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Username</label>
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 mb-4 focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-blue-500">
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
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 mb-4 focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-blue-500">
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
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-blue-500">
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
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-blue-500">
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
              className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 transition-all text-white text-sm font-medium rounded-lg py-2.5 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
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
