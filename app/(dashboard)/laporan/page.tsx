import { createClient } from "@/lib/supabase/server";
import { getPeriode, tahapanLabel } from "@/lib/periode";
import { formatRupiah } from "@/lib/terbilang";
import Link from "next/link";

type GroupBy = "pptk" | "kegiatan" | "subkegiatan" | "bulan" | "triwulan";

const TABS: { key: GroupBy; label: string }[] = [
  { key: "pptk", label: "Per PPTK" },
  { key: "kegiatan", label: "Per Kegiatan" },
  { key: "subkegiatan", label: "Per Sub Kegiatan" },
  { key: "bulan", label: "Per Bulan" },
  { key: "triwulan", label: "Per Triwulan" },
];

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export default async function LaporanPage({ searchParams }: { searchParams: { by?: string } }) {
  const { tahun, tahapan } = getPeriode();
  const by: GroupBy = (["pptk", "kegiatan", "subkegiatan", "bulan", "triwulan"].includes(searchParams.by || "")
    ? searchParams.by
    : "pptk") as GroupBy;
  const supabase = createClient();

  // Semua rekening (DPA) di periode aktif -- sumber pagu per PPTK/Kegiatan/
  // Sub Kegiatan.
  const { data: dpaList } = await supabase
    .from("dpa")
    .select(
      "id, pagu_anggaran, pptk:pejabat_skpd(nama), rekening:rekening_belanja(sub_kegiatan:sub_kegiatan(nama_sub_kegiatan, kegiatan:kegiatan(nama_kegiatan)))"
    )
    .eq("tahun_anggaran", tahun)
    .eq("tahapan", tahapan);

  // Semua pengajuan yang sudah disetujui/dicairkan di periode aktif --
  // sumber realisasi, dan tanggal untuk pengelompokan bulan/triwulan.
  const { data: realisasiList } = await supabase
    .from("pengajuan_belanja")
    .select(
      "id, tanggal, jumlah_pengajuan, dpa_id, dpa:dpa!inner(tahun_anggaran, tahapan, pptk:pejabat_skpd(nama), rekening:rekening_belanja(sub_kegiatan:sub_kegiatan(nama_sub_kegiatan, kegiatan:kegiatan(nama_kegiatan))))"
    )
    .eq("dpa.tahun_anggaran", tahun)
    .eq("dpa.tahapan", tahapan)
    .in("status", ["disetujui", "dicairkan"]);

  type Row = { key: string; pagu: number; realisasi: number };
  const rows = new Map<string, Row>();

  function bump(key: string, field: "pagu" | "realisasi", value: number) {
    const existing = rows.get(key) ?? { key, pagu: 0, realisasi: 0 };
    existing[field] += value;
    rows.set(key, existing);
  }

  if (by === "pptk" || by === "kegiatan" || by === "subkegiatan") {
    for (const d of dpaList ?? []) {
      const rek: any = (d as any).rekening;
      const key =
        by === "pptk"
          ? (d as any).pptk?.nama || "-- Belum ada PPTK --"
          : by === "kegiatan"
          ? rek?.sub_kegiatan?.kegiatan?.nama_kegiatan || "-- Tidak diketahui --"
          : rek?.sub_kegiatan?.nama_sub_kegiatan || "-- Tidak diketahui --";
      bump(key, "pagu", Number((d as any).pagu_anggaran || 0));
    }
    for (const p of realisasiList ?? []) {
      const dpaRow: any = (p as any).dpa;
      const rek: any = dpaRow?.rekening;
      const key =
        by === "pptk"
          ? dpaRow?.pptk?.nama || "-- Belum ada PPTK --"
          : by === "kegiatan"
          ? rek?.sub_kegiatan?.kegiatan?.nama_kegiatan || "-- Tidak diketahui --"
          : rek?.sub_kegiatan?.nama_sub_kegiatan || "-- Tidak diketahui --";
      bump(key, "realisasi", Number((p as any).jumlah_pengajuan || 0));
    }
  } else {
    // bulan / triwulan -- pagu anggaran tidak punya pecahan per bulan
    // (anggaran sifatnya tahunan per tahapan), jadi kolom yang relevan di
    // sini hanya realisasi per periode waktu.
    for (const p of realisasiList ?? []) {
      const tgl = new Date((p as any).tanggal);
      const bulanKe = tgl.getMonth(); // 0-11
      const key =
        by === "bulan"
          ? NAMA_BULAN[bulanKe]
          : `Triwulan ${Math.floor(bulanKe / 3) + 1}`;
      bump(key, "realisasi", Number((p as any).jumlah_pengajuan || 0));
    }
    // Supaya urutan bulan/triwulan selalu kronologis, bukan ikutan urutan
    // kemunculan transaksi.
    const urutan = by === "bulan" ? NAMA_BULAN : ["Triwulan 1", "Triwulan 2", "Triwulan 3", "Triwulan 4"];
    for (const label of urutan) {
      if (!rows.has(label)) rows.set(label, { key: label, pagu: 0, realisasi: 0 });
    }
  }

  const showPagu = by === "pptk" || by === "kegiatan" || by === "subkegiatan";
  let sortedRows = Array.from(rows.values());
  if (showPagu) {
    sortedRows.sort((a, b) => b.realisasi - a.realisasi);
  } else {
    const urutan = by === "bulan" ? NAMA_BULAN : ["Triwulan 1", "Triwulan 2", "Triwulan 3", "Triwulan 4"];
    sortedRows.sort((a, b) => urutan.indexOf(a.key) - urutan.indexOf(b.key));
  }

  const totalPagu = sortedRows.reduce((s, r) => s + r.pagu, 0);
  const totalRealisasi = sortedRows.reduce((s, r) => s + r.realisasi, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-xl text-slate-900">Laporan Realisasi</h1>
        <p className="text-sm text-slate-500">
          Tahun Anggaran {tahun}, Tahapan {tahapanLabel(tahapan)} -- hanya pengajuan berstatus
          disetujui/dicairkan yang dihitung sebagai realisasi.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/laporan?by=${t.key}`}
            className={`text-sm px-3 py-2 -mb-px border-b-2 transition-colors ${
              by === t.key
                ? "border-emerald-600 text-emerald-700 font-medium"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="font-medium px-4 py-2.5">{TABS.find((t) => t.key === by)?.label}</th>
              {showPagu && <th className="font-medium px-4 py-2.5 text-right">Pagu</th>}
              <th className="font-medium px-4 py-2.5 text-right">Realisasi</th>
              {showPagu && <th className="font-medium px-4 py-2.5 text-right">Sisa</th>}
              {showPagu && <th className="font-medium px-4 py-2.5 text-right">% Serapan</th>}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400 text-sm">
                  Belum ada data untuk periode ini.
                </td>
              </tr>
            )}
            {sortedRows.map((r) => (
              <tr key={r.key} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3 text-slate-700">{r.key}</td>
                {showPagu && <td className="px-4 py-3 text-right text-slate-600">Rp {formatRupiah(r.pagu)}</td>}
                <td className="px-4 py-3 text-right text-slate-600">Rp {formatRupiah(r.realisasi)}</td>
                {showPagu && (
                  <td className="px-4 py-3 text-right text-slate-600">Rp {formatRupiah(r.pagu - r.realisasi)}</td>
                )}
                {showPagu && (
                  <td className="px-4 py-3 text-right text-slate-600">
                    {r.pagu > 0 ? ((r.realisasi / r.pagu) * 100).toFixed(1) : "0.0"}%
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {sortedRows.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 font-medium">
                <td className="px-4 py-2.5">TOTAL</td>
                {showPagu && <td className="px-4 py-2.5 text-right">Rp {formatRupiah(totalPagu)}</td>}
                <td className="px-4 py-2.5 text-right">Rp {formatRupiah(totalRealisasi)}</td>
                {showPagu && <td className="px-4 py-2.5 text-right">Rp {formatRupiah(totalPagu - totalRealisasi)}</td>}
                {showPagu && (
                  <td className="px-4 py-2.5 text-right">
                    {totalPagu > 0 ? ((totalRealisasi / totalPagu) * 100).toFixed(1) : "0.0"}%
                  </td>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
