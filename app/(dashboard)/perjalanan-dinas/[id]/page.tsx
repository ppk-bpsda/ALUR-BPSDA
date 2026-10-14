import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPeriode } from "@/lib/periode";
import { isUuid } from "@/lib/auth";
import { loadReferensi } from "@/lib/perjadin/loaders";
import PerjadinForm, { type PerjadinInitial } from "@/components/PerjadinForm";
import HapusPerjadinButton from "@/components/HapusPerjadinButton";

export default async function PerjadinDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tersimpan?: string }>;
}) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: pj } = await supabase
    .from("perjadin")
    .select("*, peserta:perjadin_peserta(pegawai_id, urut)")
    .eq("id", id)
    .maybeSingle();
  if (!pj) notFound();

  const { tahapan } = await getPeriode();
  const ref = await loadReferensi(pj.tahun_anggaran, tahapan, pj.dpa_id);

  const initial: PerjadinInitial = {
    id: pj.id,
    nomor_surat_tugas: pj.nomor_surat_tugas ?? "",
    tanggal_surat_tugas: pj.tanggal_surat_tugas ?? "",
    maksud: pj.maksud ?? "",
    tujuan_kota: pj.tujuan_kota ?? "",
    tujuan_provinsi: pj.tujuan_provinsi ?? "",
    tanggal_berangkat: pj.tanggal_berangkat,
    tanggal_kembali: pj.tanggal_kembali,
    jenis_tarif: pj.jenis_tarif,
    tarif_uang_harian: Number(pj.tarif_uang_harian),
    biaya_lain: Array.isArray(pj.biaya_lain) ? pj.biaya_lain : [],
    dpa_id: pj.dpa_id ?? "",
    tanggal_kuitansi: pj.tanggal_kuitansi ?? "",
    nomor_kuitansi: pj.nomor_kuitansi ?? "",
    pegawai_ids: [...(pj.peserta ?? [])].sort((a: any, b: any) => a.urut - b.urut).map((p: any) => p.pegawai_id).filter(Boolean),
    surat_tugas_nama: pj.surat_tugas_nama,
    laporan_nama: pj.laporan_nama,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/perjalanan-dinas" className="text-xs text-slate-500 hover:text-brand-700 inline-flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Kembali</Link>
          <h1 className="page-title mt-2">{pj.nomor_surat_tugas || "Perjalanan Dinas"}</h1>
          <p className="page-sub">Tahun Anggaran {pj.tahun_anggaran} · ubah data lalu simpan untuk memperbarui kuitansi.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <a className="btn-primary" href={`/api/perjalanan-dinas/${id}/kuitansi`}><Download className="h-4 w-4" /> Kuitansi SPPD</a>
          <a className="btn-secondary" href={`/api/perjalanan-dinas/${id}/kuitansi?warna=hitam`}><Download className="h-4 w-4" /> Siap cetak</a>
          <HapusPerjadinButton id={id} redirectTo="/perjalanan-dinas" />
        </div>
      </div>

      {sp.tersimpan && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Data tersimpan. Kuitansi SPPD siap diunduh. Teks <span className="text-red-600 font-medium">merah</span> = isian otomatis sistem; gunakan &quot;Siap cetak&quot; untuk versi tanpa warna.
        </div>
      )}

      {(pj.surat_tugas_path || pj.laporan_path) && (
        <div className="flex flex-wrap gap-2 text-sm">
          {pj.surat_tugas_path && <a className="btn-secondary" href={`/api/perjalanan-dinas/${id}/berkas?jenis=surat_tugas`}><FileText className="h-4 w-4" /> Surat Tugas: {pj.surat_tugas_nama}</a>}
          {pj.laporan_path && <a className="btn-secondary" href={`/api/perjalanan-dinas/${id}/berkas?jenis=laporan`}><FileText className="h-4 w-4" /> Laporan: {pj.laporan_nama}</a>}
        </div>
      )}

      <PerjadinForm tahun={pj.tahun_anggaran} pegawai={ref.pegawai} sbu={ref.sbu} dpa={ref.dpa} initial={initial} />
    </div>
  );
}
