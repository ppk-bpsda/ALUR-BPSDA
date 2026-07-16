import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/terbilang";
import { getPeriode, tahapanLabel } from "@/lib/periode";
import Link from "next/link";
import { Plus } from "lucide-react";
import GenerateButtons from "./GenerateButtons";

export default async function PengajuanPage() {
  const { tahun, tahapan } = getPeriode();
  const supabase = createClient();
  const { data: list } = await supabase
    .from("pengajuan_belanja")
    .select(
      "id, nomor_bukti, tanggal, uraian_kegiatan, jumlah_pengajuan, status, dpa:dpa!inner(tahun_anggaran, tahapan, rekening:rekening_belanja(kode_rekening))"
    )
    .eq("dpa.tahun_anggaran", tahun)
    .eq("dpa.tahapan", tahapan)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-xl text-slate-900">Pengajuan Belanja</h1>
          <p className="text-sm text-slate-500">
            Tahun Anggaran {tahun}, Tahapan {tahapanLabel(tahapan)} -- dicetak jadi dokumen dari sini.
          </p>
        </div>
        <Link
          href="/pengajuan/baru"
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2"
        >
          <Plus className="h-4 w-4" /> Pengajuan Baru
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="font-medium px-4 py-2.5">Tanggal</th>
              <th className="font-medium px-4 py-2.5">Kode Rekening</th>
              <th className="font-medium px-4 py-2.5">Uraian</th>
              <th className="font-medium px-4 py-2.5">Jumlah</th>
              <th className="font-medium px-4 py-2.5">Status</th>
              <th className="font-medium px-4 py-2.5">Dokumen</th>
            </tr>
          </thead>
          <tbody>
            {(list ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-sm">
                  Belum ada pengajuan.
                </td>
              </tr>
            )}
            {(list ?? []).map((row: any) => (
              <tr key={row.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3 text-slate-500 text-xs">{row.tanggal}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">
                  {row.dpa?.rekening?.kode_rekening}
                </td>
                <td className="px-4 py-3 text-slate-700 max-w-sm truncate">{row.uraian_kegiatan}</td>
                <td className="px-4 py-3 text-slate-700">Rp {formatRupiah(row.jumlah_pengajuan)}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{row.status}</td>
                <td className="px-4 py-3">
                  <GenerateButtons pengajuanId={row.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
