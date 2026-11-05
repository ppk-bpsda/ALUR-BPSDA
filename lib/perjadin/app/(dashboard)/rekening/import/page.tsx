import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPeriode, tahapanLabel } from "@/lib/periode";
import RekeningImport from "@/components/RekeningImport";

export default async function RekeningImportPage() {
  const { tahun, tahapan } = await getPeriode();
  const supabase = await createClient();
  const { data: log } = await supabase
    .from("anggaran_log").select("created_at, username, tahapan, sumber, aksi, kode_rekening, sumber_dana, pagu_lama, pagu_baru")
    .eq("tahun_anggaran", tahun).order("created_at", { ascending: false }).limit(20);
  const rp = (n: any) => (n === null || n === undefined ? "—" : new Intl.NumberFormat("id-ID").format(Math.round(Number(n))));
  const label = `${tahapanLabel(tahapan)} ${tahun}`;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/rekening" className="text-xs text-slate-500 hover:text-brand-700 inline-flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Rekening &amp; Pagu</Link>
        <h1 className="page-title mt-2">Impor / Perbarui Pagu dari Excel</h1>
        <p className="page-sub">
          Tujuan: <b>{label}</b> (ganti lewat menu periode). Baris yang rekeningnya sudah ada diperbarui paginya; rekening, sub kegiatan,
          atau kegiatan yang belum ada dibuat otomatis bila namanya diisi. Selalu periksa pratinjau sebelum menyimpan.
        </p>
      </div>

      <div className="card p-5 text-sm text-slate-600 space-y-2">
        <p className="font-medium text-slate-900">Format berkas</p>
        <p>Kolom wajib: <code>kode_rekening</code>, <code>sumber_dana</code>, <code>pagu_anggaran</code>. Untuk sub kegiatan/rekening baru isi juga
          <code> kode_sub_kegiatan</code>, <code>nama_sub_kegiatan</code>, <code>jenis_belanja</code> (uraian), serta <code>kode_kegiatan</code>/<code>nama_kegiatan</code> dan
          <code> kode_program</code>/<code>nama_program</code> bila tingkat itu juga baru. Opsional: <code>kelompok_belanja</code>, <code>nama_pptk</code>.</p>
        <a className="btn-secondary !py-1.5 inline-flex" href="/templates/template-rekening-pagu.csv" download><Download className="h-4 w-4" /> Unduh template (CSV)</a>
      </div>

      <RekeningImport periode={label} />

      <section className="card p-5">
        <h2 className="font-serif text-lg text-slate-900 mb-3">Riwayat perubahan pagu terakhir</h2>
        {(log ?? []).length === 0 ? <p className="text-sm text-slate-500">Belum ada riwayat (atau migrasi 20260804000000_anggaran_log.sql belum dijalankan).</p> : (
          <div className="overflow-x-auto"><table className="w-full text-xs min-w-[700px]">
            <thead><tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2 font-medium">Waktu</th><th className="font-medium">Oleh</th><th className="font-medium">Tahapan</th><th className="font-medium">Aksi</th>
              <th className="font-medium">Kode Rekening</th><th className="font-medium text-right">Lama</th><th className="font-medium text-right">Baru</th></tr></thead>
            <tbody>{(log ?? []).map((l: any, i: number) => (
              <tr key={i} className="border-b border-slate-50">
                <td className="py-1.5 text-slate-500">{new Date(l.created_at).toLocaleString("id-ID")}</td><td>{l.username || "-"}</td>
                <td>{tahapanLabel(l.tahapan)}</td><td>{l.aksi} ({l.sumber})</td>
                <td className="font-mono text-slate-600">{l.kode_rekening}</td><td className="text-right">{rp(l.pagu_lama)}</td><td className="text-right">{rp(l.pagu_baru)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
