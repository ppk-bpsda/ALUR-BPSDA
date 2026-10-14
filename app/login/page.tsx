import { ShieldCheck, FileText, Plane, Droplets } from "lucide-react";
import { TAHUN_OPTIONS, TAHAPAN_OPTIONS } from "@/lib/periode";
import LoginForm from "./LoginForm";

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const searchParams = await props.searchParams;
  return (
    <div className="min-h-screen w-full bg-[#eef2f5] flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -right-32 h-[30rem] w-[30rem] rounded-full bg-brand-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-sky-200/40 blur-3xl" />

      <div className="relative w-full max-w-4xl grid md:grid-cols-[1.05fr_1fr] rounded-3xl overflow-hidden shadow-lift bg-white ring-1 ring-slate-200/70 animate-fade-up">
        {/* Panel kiri */}
        <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-ink-900 via-ink-800 to-brand-900 p-10 relative overflow-hidden text-white">
          <div className="absolute -right-16 -bottom-16 h-64 w-64 rounded-full border border-white/10" />
          <div className="absolute -right-6 -bottom-6 h-40 w-40 rounded-full border border-white/10" />

          <div className="relative">
            <div className="bg-white rounded-2xl p-2.5 w-fit shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="ALUR-BPSDA" width={84} height={84} className="rounded-lg" />
            </div>
            <h1 className="mt-9 font-serif text-[1.9rem] leading-tight">
              Sistem Administrasi
              <br />
              Penyusunan SPJ
            </h1>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed max-w-xs">
              Satu tempat untuk mengelola pagu anggaran, menyusun Nota Dinas, SPP/SPTJB,
              Kwitansi GU, dan Kuitansi Perjalanan Dinas secara konsisten dan tercatat rapi.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-slate-300">
              <li className="flex items-center gap-3"><FileText className="h-4 w-4 text-brand-300" /> Dokumen terisi otomatis</li>
              <li className="flex items-center gap-3"><Plane className="h-4 w-4 text-brand-300" /> Administrasi perjalanan dinas</li>
              <li className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-brand-300" /> Akses terbatas untuk admin</li>
            </ul>
          </div>

          <div className="relative flex items-center gap-2 text-xs text-brand-200/80">
            <Droplets className="h-3.5 w-3.5" />
            Bagian Perekonomian &amp; SDA &middot; Setda Kota Batu
          </div>
        </div>

        {/* Panel kanan */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="md:hidden mb-6 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" width={40} height={40} className="rounded-lg" />
            <p className="text-sm tracking-[0.16em] font-semibold text-brand-700">ALUR-BPSDA</p>
          </div>
          <p className="text-[11px] tracking-[0.18em] text-brand-600 font-semibold mb-1.5">MASUK</p>
          <h2 className="font-serif text-2xl text-slate-900 mb-1">Selamat datang</h2>
          <p className="text-sm text-slate-500 mb-7">Masuk dengan akun Admin untuk melanjutkan.</p>

          {searchParams?.error && (
            <div role="alert" className="mb-5 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
              {searchParams.error}
            </div>
          )}

          <LoginForm
            tahunOptions={TAHUN_OPTIONS.map((y) => ({ value: y, label: String(y) }))}
            tahapanOptions={TAHAPAN_OPTIONS.map((t) => ({ value: t.value, label: t.label }))}
          />

          <p className="mt-6 text-xs text-slate-400 leading-relaxed">
            Lupa kata sandi? Hubungi administrator sistem. Tahun Anggaran &amp; Tahapan yang dipilih
            menjadi periode aktif selama sesi ini dan dapat diganti lewat menu akun.
          </p>
        </div>
      </div>
    </div>
  );
}
