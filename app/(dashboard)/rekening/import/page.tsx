import Link from "next/link";
import { ArrowLeft, Download, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPeriode, tahapanLabel } from "@/lib/periode";
import RekeningImport from "@/components/RekeningImport";

export default async function RekeningImportPage() {
  const { tahun, tahapan } = await getPeriode();
  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("anggaran_batch").select("created_at, username, tahapan, sumber, nama_berkas, ringkasan")
    .eq("tahun_anggaran", tahun).order("created_at", { ascending: false }).limit(8);
  const label = `${tahapanLabel(tahapan)} ${tahun}`;
  const kolomTahapan = `pagu_${tahapan}`;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/rekening" className="text-xs text-slate-500 hover:text-brand-700 inline-flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Input Anggaran</Link>
        <h1 className="page-title mt-2">Unggah Pagu dari Excel</h1>
        <p className="page-sub">
          Tujuan: <b>{label}</b> (ganti lewat menu periode). Yang disimpan hanya kolom <code>{kolomTahapan}</code>.
          Selalu periksa pratinjau sebelum menyimpan; seluruh penyimpanan berlangsung dalam satu transaksi (gagal = tidak ada yang berubah).
        </p>
      </div>

      <div className="card p-5 text-sm text-slate-600 space-y-3">
        <p className="font-medium text-slate-900">Cara cepat: 3 langkah</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Unduh <b>format isian</b> (sudah berisi semua belanja {tahun}).</li>
          <li>Di Excel, ubah <b>hanya kolom <code>{kolomTahapan}</code></b> untuk {tahapanLabel(tahapan)}. Kolom lain jangan diubah. Mau tambah belanja baru? Tambah baris di bawah.</li>
          <li>Unggah di sini → baca hasil pemeriksaan → tekan <b>Simpan</b>. Bila ada yang salah, sistem menunjukkan baris dan alasannya, dan tidak ada yang tersimpan sebelum Anda setuju.</li>
        </ol>
        <p className="text-xs text-slate-500">Hanya ingin mengubah beberapa belanja? Lebih mudah lewat tombol <i>Ubah</i> di halaman <Link href="/rekening" className="underline">Input Anggaran</Link>.</p>
        <div className="flex flex-wrap gap-2">
          <a className="btn-primary !py-1.5 inline-flex" href="/api/rekening/format"><Download className="h-4 w-4" /> Unduh format isian</a>
          <a className="btn-secondary !py-1.5 inline-flex" href="/api/rekening/format?kosong=1"><Download className="h-4 w-4" /> Format kosong (tahun baru)</a>
        </div>
      </div>

      <RekeningImport periode={label} tahun={tahun} tahapan={tahapan} />

      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-lg text-slate-900">Penyimpanan terakhir</h2>
          <Link href="/rekening/riwayat" className="text-xs text-brand-700 hover:underline inline-flex items-center gap-1"><History className="h-3.5 w-3.5" /> Riwayat lengkap per rekening</Link>
        </div>
        {(batch ?? []).length === 0 ? <p className="text-sm text-slate-500">Belum ada riwayat (atau migrasi 20260810000000_audit_pagu_dan_simpan_atomik.sql belum dijalankan).</p> : (
          <div className="overflow-x-auto"><table className="w-full text-xs min-w-[640px]">
            <thead><tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2 font-medium">Waktu</th><th className="font-medium">Oleh</th><th className="font-medium">Tahapan</th><th className="font-medium">Asal</th><th className="font-medium">Berkas</th><th className="font-medium">Hasil</th></tr></thead>
            <tbody>{(batch ?? []).map((b: any, i: number) => {
              const h = b.ringkasan?.hasil ?? b.ringkasan;
              return (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-1.5 text-slate-500">{new Date(b.created_at).toLocaleString("id-ID")}</td><td>{b.username || "-"}</td>
                  <td>{tahapanLabel(b.tahapan)}</td><td>{b.sumber}</td><td className="text-slate-600">{b.nama_berkas || "-"}</td>
                  <td className="text-slate-500">{h ? Object.entries(h).filter(([k, v]) => ["tambah", "ubah", "koreksi", "rekeningBaru", "ditambah"].includes(k) && Number(v) > 0).map(([k, v]) => `${k} ${v}`).join(", ") || "tanpa perubahan" : "-"}</td>
                </tr>);
            })}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
