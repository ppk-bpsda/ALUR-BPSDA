import { createClient } from "@/lib/supabase/server";
import { getPeriode, TAHUN_OPTIONS, TAHAPAN_OPTIONS } from "@/lib/periode";
import { gantiPeriode, simpanTanggalTahapan } from "./actions";
import { CalendarRange, CalendarClock, CheckCircle2 } from "lucide-react";

export default async function PeriodePage({
  searchParams,
}: {
  searchParams: { tanggal_tersimpan?: string; disortir?: string };
}) {
  const periode = getPeriode();
  const supabase = createClient();

  // Tanggal penetapan yang sedang tersimpan untuk tahun aktif -- diambil
  // per tahapan (semua baris DPA tahapan yang sama seharusnya punya
  // tanggal_penetapan yang sama; kalau beda-beda -- mis. data lama --
  // ambil yang pertama saja sebagai representasi).
  const { data: dpaTanggal } = await supabase
    .from("dpa")
    .select("tahapan, tanggal_penetapan")
    .eq("tahun_anggaran", periode.tahun);
  const tanggalTerkini: Record<string, string> = {};
  for (const row of dpaTanggal ?? []) {
    const t = (row as any).tahapan as string;
    if (!(t in tanggalTerkini) && (row as any).tanggal_penetapan) {
      tanggalTerkini[t] = (row as any).tanggal_penetapan;
    }
  }

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

      <form action={simpanTanggalTahapan} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <CalendarClock className="h-4 w-4" />
          <span>Tanggal Penetapan Tahapan -- Tahun Anggaran {periode.tahun}</span>
        </div>
        <p className="text-xs text-slate-400 -mt-2">
          Menentukan otomatis tahapan mana yang berlaku untuk tiap transaksi, berdasarkan tanggal transaksi
          (bukan periode aktif yang sedang dipilih). Kosongkan Murni kalau berlaku sejak awal tahun anggaran.
          Setelah disimpan, seluruh Pengajuan Belanja tahun ini otomatis disortir ulang ke tahapan yang benar.
        </p>

        {searchParams.tanggal_tersimpan === "1" && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Tersimpan. {searchParams.disortir ?? "0"} pengajuan disortir ulang ke tahapan yang benar.
          </div>
        )}

        <input type="hidden" name="tahun_anggaran" value={periode.tahun} />

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Tanggal Penetapan Murni</label>
            <input
              type="date"
              name="tanggal_murni"
              defaultValue={tanggalTerkini.murni ?? ""}
              placeholder="Awal tahun anggaran"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Tanggal Penetapan Pergeseran</label>
            <input
              type="date"
              name="tanggal_pergeseran"
              defaultValue={tanggalTerkini.pergeseran ?? ""}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Tanggal Penetapan Perubahan</label>
            <input
              type="date"
              name="tanggal_perubahan"
              defaultValue={tanggalTerkini.perubahan ?? ""}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
            />
          </div>
        </div>

        <button
          type="submit"
          className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg px-4 py-2"
        >
          Simpan Tanggal &amp; Sortir Ulang Pengajuan
        </button>
      </form>
    </div>
  );
}
