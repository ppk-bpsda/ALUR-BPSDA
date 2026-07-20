import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/terbilang";
import { getPeriode, tahapanLabel } from "@/lib/periode";
import { Wallet, Receipt, FileSpreadsheet, ClipboardList } from "lucide-react";
import Link from "next/link";

const statusStyle: Record<string, string> = {
  disetujui: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  diajukan: "bg-amber-50 text-amber-700 ring-amber-200",
  dicairkan: "bg-sky-50 text-sky-700 ring-sky-200",
  draft: "bg-slate-100 text-slate-600 ring-slate-200",
  ditolak: "bg-rose-50 text-rose-700 ring-rose-200",
};

type GroupBy = "pptk" | "kegiatan" | "subkegiatan" | "bulan" | "triwulan";

const LAPORAN_TABS: { key: GroupBy; label: string }[] = [
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

export default async function DashboardPage({ searchParams }: { searchParams: { laporan?: string } }) {
  const { tahun, tahapan } = getPeriode();
  const supabase = createClient();

  const { data: rekap } = await supabase
    .from("rekap_realisasi")
    .select("*")
    .eq("tahun_anggaran", tahun)
    .eq("tahapan", tahapan);
  const totalPagu = (rekap ?? []).reduce((s, r: any) => s + Number(r.pagu_anggaran || 0), 0);
  const totalRealisasi = (rekap ?? []).reduce((s, r: any) => s + Number(r.total_realisasi || 0), 0);
  const totalSisa = totalPagu - totalRealisasi;

  const { data: pengajuanTerbaru } = await supabase
    .from("pengajuan_belanja")
    .select("id, nomor_bukti, uraian_kegiatan, jumlah_pengajuan, status, created_at, dpa:dpa!inner(tahun_anggaran, tahapan)")
    .eq("dpa.tahun_anggaran", tahun)
    .eq("dpa.tahapan", tahapan)
    .order("created_at", { ascending: false })
    .limit(8);

  const bulanIni = new Date();
  const { count: pengajuanBulanIni } = await supabase
    .from("pengajuan_belanja")
    .select("id, dpa:dpa!inner(tahun_anggaran, tahapan)", { count: "exact", head: true })
    .eq("dpa.tahun_anggaran", tahun)
    .eq("dpa.tahapan", tahapan)
    .gte("created_at", new Date(bulanIni.getFullYear(), bulanIni.getMonth(), 1).toISOString());

  // -----------------------------------------------------------------
  // Laporan Realisasi (per PPTK/Kegiatan/Sub Kegiatan/Bulan/Triwulan) --
  // digabung ke Dashboard supaya tidak perlu pindah menu untuk melihat
  // ringkasan sekaligus rinciannya.
  // -----------------------------------------------------------------
  const by: GroupBy = (["pptk", "kegiatan", "subkegiatan", "bulan", "triwulan"].includes(searchParams.laporan || "")
    ? searchParams.laporan
    : "pptk") as GroupBy;

  const { data: dpaList } = await supabase
    .from("dpa")
    .select(
      "id, pagu_anggaran, pptk:pejabat_skpd(nama), rekening:rekening_belanja(sub_kegiatan:sub_kegiatan(nama_sub_kegiatan, kegiatan:kegiatan(nama_kegiatan)))"
    )
    .eq("tahun_anggaran", tahun)
    .eq("tahapan", tahapan);

  const { data: realisasiList } = await supabase
    .from("pengajuan_belanja")
    .select(
      "id, tanggal, jumlah_pengajuan, dpa_id, dpa:dpa!inner(tahun_anggaran, tahapan, pptk:pejabat_skpd(nama), rekening:rekening_belanja(sub_kegiatan:sub_kegiatan(nama_sub_kegiatan, kegiatan:kegiatan(nama_kegiatan))))"
    )
    .eq("dpa.tahun_anggaran", tahun)
    .eq("dpa.tahapan", tahapan)
    .in("status", ["disetujui", "dicairkan"]);

  type LaporanRow = { key: string; pagu: number; realisasi: number };
  const laporanRows = new Map<string, LaporanRow>();
  function bump(key: string, field: "pagu" | "realisasi", value: number) {
    const existing = laporanRows.get(key) ?? { key, pagu: 0, realisasi: 0 };
    existing[field] += value;
    laporanRows.set(key, existing);
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
    for (const p of realisasiList ?? []) {
      const tgl = new Date((p as any).tanggal);
      const bulanKe = tgl.getMonth();
      const key = by === "bulan" ? NAMA_BULAN[bulanKe] : `Triwulan ${Math.floor(bulanKe / 3) + 1}`;
      bump(key, "realisasi", Number((p as any).jumlah_pengajuan || 0));
    }
    const urutan = by === "bulan" ? NAMA_BULAN : ["Triwulan 1", "Triwulan 2", "Triwulan 3", "Triwulan 4"];
    for (const label of urutan) {
      if (!laporanRows.has(label)) laporanRows.set(label, { key: label, pagu: 0, realisasi: 0 });
    }
  }

  const showPagu = by === "pptk" || by === "kegiatan" || by === "subkegiatan";
  let sortedLaporanRows = Array.from(laporanRows.values());
  if (showPagu) {
    sortedLaporanRows.sort((a, b) => b.realisasi - a.realisasi);
  } else {
    const urutan = by === "bulan" ? NAMA_BULAN : ["Triwulan 1", "Triwulan 2", "Triwulan 3", "Triwulan 4"];
    sortedLaporanRows.sort((a, b) => urutan.indexOf(a.key) - urutan.indexOf(b.key));
  }
  const totalLaporanPagu = sortedLaporanRows.reduce((s, r) => s + r.pagu, 0);
  const totalLaporanRealisasi = sortedLaporanRows.reduce((s, r) => s + r.realisasi, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-xl text-slate-900">Selamat datang kembali, Admin</h1>
        <p className="text-sm text-slate-500">
          Ringkasan anggaran &amp; pengajuan -- Tahun Anggaran {tahun}, Tahapan {tahapanLabel(tahapan)}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Pagu" value={`Rp ${formatRupiah(totalPagu)}`} icon={Wallet} color="blue" />
        <StatCard
          label="Total Realisasi"
          value={`Rp ${formatRupiah(totalRealisasi)}`}
          delta={totalPagu ? `${((totalRealisasi / totalPagu) * 100).toFixed(1)}% dari pagu` : "-"}
          icon={Receipt}
          color="emerald"
        />
        <StatCard label="Sisa Anggaran" value={`Rp ${formatRupiah(totalSisa)}`} icon={FileSpreadsheet} color="cyan" />
        <StatCard label="Pengajuan Bulan Ini" value={String(pengajuanBulanIni ?? 0)} icon={ClipboardList} color="amber" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-5 pb-3">
          <p className="text-sm font-medium text-slate-900">Pengajuan Terbaru</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="font-medium px-5 py-2.5">Nomor Bukti</th>
              <th className="font-medium px-5 py-2.5">Uraian</th>
              <th className="font-medium px-5 py-2.5">Jumlah</th>
              <th className="font-medium px-5 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {(pengajuanTerbaru ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-slate-400 text-sm">
                  Belum ada pengajuan. Mulai dari menu "Pengajuan Belanja".
                </td>
              </tr>
            )}
            {(pengajuanTerbaru ?? []).map((row: any) => (
              <tr key={row.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 text-slate-500 font-mono text-xs">{row.nomor_bukti || "-"}</td>
                <td className="px-5 py-3 text-slate-700 max-w-md truncate">{row.uraian_kegiatan}</td>
                <td className="px-5 py-3 text-slate-700">Rp {formatRupiah(row.jumlah_pengajuan)}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${
                      statusStyle[row.status] ?? statusStyle.draft
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-900 mb-2">Laporan Realisasi</p>
        <div className="flex flex-wrap gap-2 border-b border-slate-200 mb-0">
          {LAPORAN_TABS.map((t) => (
            <Link
              key={t.key}
              href={`/?laporan=${t.key}`}
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

        <div className="bg-white rounded-xl border border-slate-200 border-t-0 rounded-t-none overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="font-medium px-4 py-2.5">{LAPORAN_TABS.find((t) => t.key === by)?.label}</th>
                {showPagu && <th className="font-medium px-4 py-2.5 text-right">Pagu</th>}
                <th className="font-medium px-4 py-2.5 text-right">Realisasi</th>
                {showPagu && <th className="font-medium px-4 py-2.5 text-right">Sisa</th>}
                {showPagu && <th className="font-medium px-4 py-2.5 text-right">% Serapan</th>}
              </tr>
            </thead>
            <tbody>
              {sortedLaporanRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400 text-sm">
                    Belum ada data untuk periode ini.
                  </td>
                </tr>
              )}
              {sortedLaporanRows.map((r) => (
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
            {sortedLaporanRows.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-200 font-medium">
                  <td className="px-4 py-2.5">TOTAL</td>
                  {showPagu && <td className="px-4 py-2.5 text-right">Rp {formatRupiah(totalLaporanPagu)}</td>}
                  <td className="px-4 py-2.5 text-right">Rp {formatRupiah(totalLaporanRealisasi)}</td>
                  {showPagu && (
                    <td className="px-4 py-2.5 text-right">
                      Rp {formatRupiah(totalLaporanPagu - totalLaporanRealisasi)}
                    </td>
                  )}
                  {showPagu && (
                    <td className="px-4 py-2.5 text-right">
                      {totalLaporanPagu > 0 ? ((totalLaporanRealisasi / totalLaporanPagu) * 100).toFixed(1) : "0.0"}%
                    </td>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, delta, icon: Icon, color = "blue",
}: {
  label: string; value: string; delta?: string; icon: any; color?: "blue" | "emerald" | "cyan" | "amber";
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    cyan: "bg-cyan-50 text-cyan-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs text-slate-500">{label}</p>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
      </div>
      <p className="mt-3 font-serif text-2xl text-slate-900">{value}</p>
      {delta && <p className="mt-2 text-xs font-medium text-emerald-600">{delta}</p>}
    </div>
  );
}
