import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/terbilang";
import { getPeriode, tahapanLabel } from "@/lib/periode";
import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import GenerateButtons from "./GenerateButtons";
import RowActions from "./RowActions";
import StatusSelect from "./StatusSelect";
import PengajuanFilter from "./PengajuanFilter";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  diajukan: "Diajukan",
  disetujui: "Disetujui",
  dicairkan: "Dicairkan",
  ditolak: "Ditolak",
};

export default async function PengajuanPage({
  searchParams,
}: {
  searchParams: {
    status?: string;
    kegiatan?: string;
    sub_kegiatan?: string;
    rekening?: string;
    dari?: string;
    sampai?: string;
  };
}) {
  const { tahun, tahapan } = getPeriode();
  const supabase = createClient();
  const statusFilter = Object.keys(STATUS_LABEL).includes(searchParams.status || "")
    ? (searchParams.status as string)
    : undefined;
  const kegiatanFilter = searchParams.kegiatan || undefined;
  const subKegiatanFilter = searchParams.sub_kegiatan || undefined;
  const rekeningFilter = searchParams.rekening || undefined;
  const dariFilter = searchParams.dari || undefined;
  const sampaiFilter = searchParams.sampai || undefined;

  const [{ data: kegiatanList }, { data: subKegiatanList }, { data: rekeningList }] = await Promise.all([
    supabase
      .from("kegiatan")
      .select("id, nama_kegiatan")
      .eq("tahun_anggaran", tahun)
      .order("kode_kegiatan"),
    supabase
      .from("sub_kegiatan")
      .select("id, nama_sub_kegiatan, kegiatan_id")
      .eq("tahun_anggaran", tahun)
      .order("kode_sub_kegiatan"),
    supabase
      .from("rekening_belanja")
      .select("id, jenis_belanja, sub_kegiatan_id")
      .order("jenis_belanja"),
  ]);

  let query = supabase
    .from("pengajuan_belanja")
    .select(
      "id, nomor_bukti, metode_pembayaran, tanggal, uraian_kegiatan, jumlah_pengajuan, status, dpa:dpa!inner(tahun_anggaran, tahapan, rekening_id, rekening:rekening_belanja!inner(kode_rekening, sub_kegiatan_id, sub_kegiatan:sub_kegiatan!inner(kegiatan_id)))"
    )
    .eq("dpa.tahun_anggaran", tahun)
    .eq("dpa.tahapan", tahapan)
    .order("tanggal", { ascending: false });
  if (statusFilter) query = query.eq("status", statusFilter);
  if (kegiatanFilter) query = query.eq("dpa.rekening.sub_kegiatan.kegiatan_id", kegiatanFilter);
  if (subKegiatanFilter) query = query.eq("dpa.rekening.sub_kegiatan_id", subKegiatanFilter);
  if (rekeningFilter) query = query.eq("dpa.rekening_id", rekeningFilter);
  if (dariFilter) query = query.gte("tanggal", dariFilter);
  if (sampaiFilter) query = query.lte("tanggal", sampaiFilter);
  const { data: list } = await query;

  // Nominal Realisasi dari hasil filter yang sedang ditampilkan --
  // konsisten dengan definisi Realisasi di Dashboard/rekap: hanya
  // status "dicairkan" yang dihitung terealisasi secara kas.
  const nominalRealisasi = (list ?? [])
    .filter((row: any) => row.status === "dicairkan")
    .reduce((s: number, row: any) => s + Number(row.jumlah_pengajuan || 0), 0);
  const totalDitampilkan = (list ?? []).reduce((s: number, row: any) => s + Number(row.jumlah_pengajuan || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-xl text-slate-900">Pengajuan Belanja</h1>
          <p className="text-sm text-slate-500">
            Tahun Anggaran {tahun}, Tahapan {tahapanLabel(tahapan)} -- dicetak jadi dokumen dari sini.
            {statusFilter && (
              <> Menampilkan status <span className="font-medium text-slate-700">{STATUS_LABEL[statusFilter]}</span>.</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/pengajuan/import"
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg px-4 py-2"
          >
            <Upload className="h-4 w-4" /> Import
          </Link>
          <Link
            href="/pengajuan/baru"
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            <Plus className="h-4 w-4" /> Pengajuan Baru
          </Link>
        </div>
      </div>

      <PengajuanFilter
        kegiatanList={kegiatanList ?? []}
        subKegiatanList={subKegiatanList ?? []}
        rekeningList={rekeningList ?? []}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-emerald-50/60 rounded-xl border border-emerald-200 p-4">
          <p className="text-xs text-emerald-700/80">Nominal Realisasi (status Dicairkan)</p>
          <p className="text-xl font-serif text-emerald-800 mt-1">Rp {formatRupiah(nominalRealisasi)}</p>
          <p className="text-xs text-emerald-700/70 mt-1">dari hasil pencarian/filter saat ini</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400">Total Ditampilkan (semua status)</p>
          <p className="text-xl font-serif text-slate-800 mt-1">Rp {formatRupiah(totalDitampilkan)}</p>
          <p className="text-xs text-slate-400 mt-1">{(list ?? []).length} baris pengajuan</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="font-medium px-4 py-2.5">Tanggal</th>
              <th className="font-medium px-4 py-2.5">Kode Rekening</th>
              <th className="font-medium px-4 py-2.5">Uraian</th>
              <th className="font-medium px-4 py-2.5">Jumlah</th>
              <th className="font-medium px-4 py-2.5">Status</th>
              <th className="font-medium px-4 py-2.5">Metode</th>
              <th className="font-medium px-4 py-2.5">Dokumen</th>
              <th className="font-medium px-4 py-2.5">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {(list ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400 text-sm">
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
                <td className="px-4 py-3 text-xs text-slate-500">
                  <StatusSelect pengajuanId={row.id} status={row.status} />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${
                      row.metode_pembayaran === "LS"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-sky-50 text-sky-700"
                    }`}
                  >
                    {row.metode_pembayaran || "GU"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <GenerateButtons pengajuanId={row.id} metodePembayaran={row.metode_pembayaran || "GU"} />
                </td>
                <td className="px-4 py-3">
                  <RowActions pengajuanId={row.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
