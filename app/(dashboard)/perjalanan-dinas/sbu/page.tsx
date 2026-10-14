import { createClient } from "@/lib/supabase/server";
import { getPeriode } from "@/lib/periode";
import ImportExcel from "@/components/ImportExcel";

export const metadata = { title: "SBU Uang Harian" };
const rp = (n: number) => (n ? new Intl.NumberFormat("id-ID").format(n) : "—");

export default async function SbuPage() {
  const { tahun } = await getPeriode();
  const supabase = await createClient();
  const { data, error } = await supabase.from("perjadin_sbu").select("*").eq("tahun_anggaran", tahun).order("tujuan");
  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">SBU Uang Harian</h1>
          <p className="page-sub">Standar Biaya Uang Harian per tujuan — Tahun Anggaran {tahun}. Dipakai otomatis untuk menghitung Kuitansi SPPD.</p>
        </div>
        <ImportExcel jenis="sbu" tahun={tahun} label={`Impor SBU ${tahun} dari Excel`} />
      </div>
      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Tabel belum tersedia — jalankan migrasi 20260802000000.</div>}
      {!error && rows.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Belum ada SBU untuk Tahun Anggaran {tahun}. Impor berkas Excel (kolom: Tujuan, Satuan, Uang Harian Rapat, Uang Harian Diklat, Uang Harian Perjalanan Dinas Dalam Negeri).
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-slate-50/80 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Tujuan</th>
              <th className="px-4 py-3 text-left font-medium">Satuan</th>
              <th className="px-4 py-3 text-right font-medium">Rapat (Rp)</th>
              <th className="px-4 py-3 text-right font-medium">Diklat (Rp)</th>
              <th className="px-4 py-3 text-right font-medium">Perjalanan Dinas (Rp)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r: any) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-medium text-slate-800">{r.tujuan}</td>
                <td className="px-4 py-2.5 text-slate-500">{r.satuan}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{rp(Number(r.uang_harian_rapat))}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{rp(Number(r.uang_harian_diklat))}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-800">{rp(Number(r.uang_harian_perjalanan))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
