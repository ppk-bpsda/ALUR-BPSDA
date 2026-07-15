import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/terbilang";

const TAHUN_SEKARANG = new Date().getFullYear();

export default async function RekapPage() {
  const supabase = createClient();
  const { data: rekap } = await supabase
    .from("rekap_realisasi")
    .select("*")
    .eq("tahun_anggaran", TAHUN_SEKARANG)
    .order("kode_sub_kegiatan");

  const totalPagu = (rekap ?? []).reduce((s, r: any) => s + Number(r.pagu_anggaran || 0), 0);
  const totalRealisasi = (rekap ?? []).reduce((s, r: any) => s + Number(r.total_realisasi || 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-xl text-slate-900">Rekap Realisasi Anggaran</h1>
        <p className="text-sm text-slate-500">
          Tahun Anggaran {TAHUN_SEKARANG}. Dihitung otomatis dari status pengajuan "disetujui"/"dicairkan".
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="font-medium px-4 py-2.5">Kode Rekening</th>
              <th className="font-medium px-4 py-2.5">Sub Kegiatan</th>
              <th className="font-medium px-4 py-2.5">Sumber Dana</th>
              <th className="font-medium px-4 py-2.5">Tahapan</th>
              <th className="font-medium px-4 py-2.5">Pagu</th>
              <th className="font-medium px-4 py-2.5">Realisasi</th>
              <th className="font-medium px-4 py-2.5">Sisa</th>
            </tr>
          </thead>
          <tbody>
            {(rekap ?? []).map((row: any, i: number) => (
              <tr key={i} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{row.kode_rekening}</td>
                <td className="px-4 py-2.5 text-slate-700">{row.nama_sub_kegiatan}</td>
                <td className="px-4 py-2.5 text-slate-500">{row.sumber_dana}</td>
                <td className="px-4 py-2.5 text-slate-500">{row.tahapan}</td>
                <td className="px-4 py-2.5 text-slate-700">Rp {formatRupiah(row.pagu_anggaran)}</td>
                <td className="px-4 py-2.5 text-slate-700">Rp {formatRupiah(row.total_realisasi)}</td>
                <td className="px-4 py-2.5 text-slate-700">Rp {formatRupiah(row.sisa_anggaran)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-medium">
              <td className="px-4 py-2.5" colSpan={4}>TOTAL</td>
              <td className="px-4 py-2.5">Rp {formatRupiah(totalPagu)}</td>
              <td className="px-4 py-2.5">Rp {formatRupiah(totalRealisasi)}</td>
              <td className="px-4 py-2.5">Rp {formatRupiah(totalPagu - totalRealisasi)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
