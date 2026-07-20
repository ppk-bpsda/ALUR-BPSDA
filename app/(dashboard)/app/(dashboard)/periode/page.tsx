import { getPeriode, TAHUN_OPTIONS, TAHAPAN_OPTIONS } from "@/lib/periode";
import { gantiPeriode } from "./actions";
import { CalendarRange } from "lucide-react";

export default function PeriodePage() {
  const periode = getPeriode();

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="font-serif text-xl text-slate-900">Ganti Periode</h1>
        <p className="text-sm text-slate-500">
          Periode aktif ini dipakai sebagai filter di menu Rekening &amp; Pagu (DPA),
          Pengajuan Belanja, dan Rekap Realisasi.
        </p>
      </div>

      <form action={gantiPeriode} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <CalendarRange className="h-4 w-4" />
          Periode aktif saat ini: <span className="font-medium text-slate-900">{periode.tahun} -- {TAHAPAN_OPTIONS.find(t => t.value === periode.tahapan)?.label}</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Tahun Anggaran</label>
            <select
              name="tahun_anggaran"
              defaultValue={periode.tahun}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
            >
              {TAHUN_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Tahapan</label>
            <select
              name="tahapan"
              defaultValue={periode.tahapan}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
            >
              {TAHAPAN_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="submit"
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2"
        >
          Terapkan Periode
        </button>
      </form>
    </div>
  );
}
