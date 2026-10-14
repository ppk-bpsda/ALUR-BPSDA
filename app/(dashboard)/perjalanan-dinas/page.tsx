import Link from "next/link";
import { Plus, Download, Pencil, Plane, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPeriode } from "@/lib/periode";
import { formatTanggalSurat } from "@/lib/format";
import { totalPerPeserta, formatRentang } from "@/lib/perjadin/kuitansi";
import HapusPerjadinButton from "@/components/HapusPerjadinButton";

export const metadata = { title: "Administrasi Perjalanan Dinas" };

export default async function PerjalananDinasPage() {
  const { tahun } = await getPeriode();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perjadin")
    .select("id, nomor_surat_tugas, maksud, tujuan_kota, tujuan_provinsi, tanggal_berangkat, tanggal_kembali, lama_hari, tarif_uang_harian, biaya_lain, surat_tugas_nama, laporan_nama, peserta:perjadin_peserta(nama)")
    .eq("tahun_anggaran", tahun)
    .order("tanggal_berangkat", { ascending: false })
    .order("created_at", { ascending: false });

  const belumMigrasi = !!error && /perjadin|schema cache|does not exist/i.test(error.message);
  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Administrasi Perjalanan Dinas</h1>
          <p className="page-sub">Unggah Surat Tugas &amp; Laporan Perjalanan Dinas — Kuitansi SPPD disusun otomatis. Tahun Anggaran {tahun}.</p>
        </div>
        <Link href="/perjalanan-dinas/baru" className="btn-primary"><Plus className="h-4 w-4" /> Perjalanan Dinas Baru</Link>
      </div>

      {belumMigrasi && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Tabel perjalanan dinas belum tersedia. Jalankan migrasi <code className="font-mono text-xs">20260802000000_administrasi_perjalanan_dinas.sql</code> di Supabase SQL Editor.
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-slate-50/80 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Surat Tugas</th>
              <th className="px-4 py-3 font-medium">Tujuan &amp; Waktu</th>
              <th className="px-4 py-3 font-medium">Pelaksana</th>
              <th className="px-4 py-3 font-medium text-right">Jumlah</th>
              <th className="px-4 py-3 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && !belumMigrasi && (
              <tr><td colSpan={5} className="px-4 py-14 text-center">
                <Plane className="h-8 w-8 mx-auto text-slate-300" strokeWidth={1.5} />
                <p className="mt-2 text-slate-500">Belum ada data perjalanan dinas pada tahun ini.</p>
                <Link href="/perjalanan-dinas/baru" className="text-brand-700 text-sm font-medium hover:underline">Buat yang pertama →</Link>
              </td></tr>
            )}
            {rows.map((r: any) => {
              const lain = Array.isArray(r.biaya_lain) ? r.biaya_lain : [];
              const nPeserta = r.peserta?.length ?? 0;
              const total = totalPerPeserta(Number(r.tarif_uang_harian), r.lama_hari, lain) * nPeserta;
              return (
                <tr key={r.id} className="hover:bg-slate-50/60 align-top">
                  <td className="px-4 py-3.5 max-w-xs">
                    <p className="font-medium text-slate-800">{r.nomor_surat_tugas || "(tanpa nomor)"}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{r.maksud}</p>
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1"><FileText className="h-3 w-3" />{r.surat_tugas_nama || "tanpa berkas"}{r.laporan_nama && " · laporan"}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-slate-800">{[r.tujuan_kota, r.tujuan_provinsi].filter(Boolean).join(", ") || "-"}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatRentang(r.tanggal_berangkat, r.tanggal_kembali)} · {r.lama_hari} hari</p>
                  </td>
                  <td className="px-4 py-3.5 text-slate-700">
                    <p>{nPeserta} orang</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{(r.peserta ?? []).map((p: any) => p.nama).join("; ")}</p>
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-medium text-slate-800">Rp {new Intl.NumberFormat("id-ID").format(total)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-end gap-1.5">
                      <a className="btn-secondary !py-1.5" href={`/api/perjalanan-dinas/${r.id}/kuitansi`} title="Unduh Kuitansi SPPD"><Download className="h-4 w-4" /></a>
                      <Link className="btn-secondary !py-1.5" href={`/perjalanan-dinas/${r.id}`} title="Buka / ubah"><Pencil className="h-4 w-4" /></Link>
                      <HapusPerjadinButton id={r.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Menu ini hanya menambah data baru dan tidak mengubah Pengajuan Belanja, DPA, maupun dokumen yang sudah ada.</p>
    </div>
  );
}
