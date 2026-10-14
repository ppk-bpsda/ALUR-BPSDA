import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPeriode } from "@/lib/periode";
import { loadReferensi } from "@/lib/perjadin/loaders";
import PerjadinForm from "@/components/PerjadinForm";

export const metadata = { title: "Perjalanan Dinas Baru" };

export default async function PerjadinBaruPage() {
  const { tahun, tahapan } = await getPeriode();
  const ref = await loadReferensi(tahun, tahapan);
  return (
    <div className="space-y-6">
      <div>
        <Link href="/perjalanan-dinas" className="text-xs text-slate-500 hover:text-brand-700 inline-flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Kembali</Link>
        <h1 className="page-title mt-2">Perjalanan Dinas Baru</h1>
        <p className="page-sub">Unggah Surat Tugas, periksa hasil bacaan otomatis, lalu simpan untuk menghasilkan Kuitansi SPPD.</p>
      </div>
      {ref.tabelBelumAda && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Migrasi database untuk menu ini belum dijalankan (lihat README).</div>
      )}
      <PerjadinForm tahun={tahun} pegawai={ref.pegawai} sbu={ref.sbu} dpa={ref.dpa} />
    </div>
  );
}
