import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/terbilang";
import { getPeriode, tahapanLabel, tahapanUpTo } from "@/lib/periode";
import {
  Wallet, Receipt, FileSpreadsheet, ClipboardList,
  FilePen, Send, CheckCircle2, Landmark, XCircle, ArrowUpRight,
} from "lucide-react";
import Link from "next/link";

const statusStyle: Record<string, string> = {
  disetujui: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  diajukan: "bg-amber-50 text-amber-700 ring-amber-200",
  dicairkan: "bg-sky-50 text-sky-700 ring-sky-200",
  draft: "bg-slate-100 text-slate-600 ring-slate-200",
  ditolak: "bg-rose-50 text-rose-700 ring-rose-200",
};

const statusLabel: Record<string, string> = {
  draft: "Draft",
  diajukan: "Diajukan",
  disetujui: "Disetujui",
  dicairkan: "Dicairkan",
  ditolak: "Ditolak",
};

// Kartu Rekap Pengajuan -- urutan mengikuti alur proses dokumen (draft ->
// diajukan -> disetujui -> dicairkan), dengan Ditolak di akhir. Tiap status
// punya warna & ikon sendiri supaya cepat dipindai secara visual.
const REKAP_STATUS: {
  key: keyof typeof statusLabel;
  icon: any;
  card: string;
  iconWrap: string;
  count: string;
}[] = [
  { key: "draft", icon: FilePen, card: "border-slate-200 bg-slate-50/60", iconWrap: "bg-slate-200/80 text-slate-600", count: "text-slate-700" },
  { key: "diajukan", icon: Send, card: "border-amber-200 bg-amber-50/60", iconWrap: "bg-amber-100 text-amber-600", count: "text-amber-700" },
  { key: "disetujui", icon: CheckCircle2, card: "border-emerald-200 bg-emerald-50/60", iconWrap: "bg-emerald-100 text-emerald-600", count: "text-emerald-700" },
  { key: "dicairkan", icon: Landmark, card: "border-sky-200 bg-sky-50/60", iconWrap: "bg-sky-100 text-sky-600", count: "text-sky-700" },
  { key: "ditolak", icon: XCircle, card: "border-rose-200 bg-rose-50/60", iconWrap: "bg-rose-100 text-rose-600", count: "text-rose-700" },
];

type GroupBy = "pptk" | "kegiatan" | "subkegiatan" | "bulan" | "triwulan";

const LAPORAN_TABS: { key: GroupBy; label: string; active: string; dot: string }[] = [
  { key: "pptk", label: "Per PPTK", active: "border-indigo-600 text-indigo-700 bg-indigo-50/70", dot: "bg-indigo-500" },
  { key: "kegiatan", label: "Per Kegiatan", active: "border-emerald-600 text-emerald-700 bg-emerald-50/70", dot: "bg-emerald-500" },
  { key: "subkegiatan", label: "Per Sub Kegiatan", active: "border-cyan-600 text-cyan-700 bg-cyan-50/70", dot: "bg-cyan-500" },
  { key: "bulan", label: "Per Bulan", active: "border-amber-600 text-amber-700 bg-amber-50/70", dot: "bg-amber-500" },
  { key: "triwulan", label: "Per Triwulan", active: "border-violet-600 text-violet-700 bg-violet-50/70", dot: "bg-violet-500" },
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

  // Pengajuan Terbaru -- diurutkan berdasarkan tanggal transaksi/tanggal
  // Nota Dinas (kolom `tanggal`) terbaru dahulu, bukan waktu input data
  // (created_at). Kalau tanggalnya sama, baru dipecah oleh created_at
  // supaya urutan tetap stabil.
  const { data: pengajuanTerbaru } = await supabase
    .from("pengajuan_belanja")
    .select(
      "id, nomor_bukti, nomor_nota_dinas, tanggal, uraian_kegiatan, jumlah_pengajuan, status, created_at, dpa:dpa!inner(tahun_anggaran, tahapan)"
    )
    .eq("dpa.tahun_anggaran", tahun)
    .eq("dpa.tahapan", tahapan)
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(8);

  const bulanIni = new Date();
  const { count: pengajuanBulanIni } = await supabase
    .from("pengajuan_belanja")
    .select("id, dpa:dpa!inner(tahun_anggaran, tahapan)", { count: "exact", head: true })
    .eq("dpa.tahun_anggaran", tahun)
    .eq("dpa.tahapan", tahapan)
    .gte("created_at", new Date(bulanIni.getFullYear(), bulanIni.getMonth(), 1).toISOString());

  // Rekap Pengajuan per status (Draft/Diajukan/Disetujui/Dicairkan/Ditolak)
  // untuk periode berjalan -- ditampilkan sebagai kartu ringkas di atas
  // tabel Pengajuan Terbaru.
  const { data: statusRows } = await supabase
    .from("pengajuan_belanja")
    .select("status, dpa:dpa!inner(tahun_anggaran, tahapan)")
    .eq("dpa.tahun_anggaran", tahun)
    .eq("dpa.tahapan", tahapan);
  const rekapStatusCount: Record<string, number> = {
    draft: 0, diajukan: 0, disetujui: 0, dicairkan: 0, ditolak: 0,
  };
  for (const r of statusRows ?? []) {
    const s = (r as any).status as string;
    if (s in rekapStatusCount) rekapStatusCount[s] += 1;
  }

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
    .in("dpa.tahapan", tahapanUpTo(tahapan))
    .eq("status", "dicairkan");

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

  const totalPengajuanRekap = Object.values(rekapStatusCount).reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-7">
      <div className="rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 px-6 py-6 text-white shadow-sm">
        <h1 className="font-serif text-2xl">Selamat datang kembali, Admin</h1>
        <p className="text-sm text-emerald-50/90 mt-1">
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

      {/* Rekap Pengajuan -- ringkasan jumlah dokumen per tahap alur, tiap
          status punya warna & ikon berbeda, dan bisa diklik untuk melihat
          daftar pengajuan dengan status tersebut. */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-900">Rekap Pengajuan</p>
          <span className="text-xs text-slate-400">{totalPengajuanRekap} dokumen periode ini</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {REKAP_STATUS.map((s) => {
            const Icon = s.icon;
            const jumlah = rekapStatusCount[s.key] ?? 0;
            const pct = totalPengajuanRekap ? Math.round((jumlah / totalPengajuanRekap) * 100) : 0;
            return (
              <Link
                key={s.key}
                href={`/pengajuan?status=${s.key}`}
                className={`group rounded-xl border ${s.card} p-4 transition-shadow hover:shadow-md`}
              >
                <div className="flex items-center justify-between">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${s.iconWrap}`}>
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>
                <p className={`mt-3 font-serif text-2xl ${s.count}`}>{jumlah}</p>
                <p className="text-xs text-slate-500 mt-0.5">{statusLabel[s.key]} &middot; {pct}%</p>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-5 pb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-900">Pengajuan Terbaru</p>
          <p className="text-xs text-slate-400">Diurutkan berdasarkan tanggal Nota Dinas terbaru</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100 bg-slate-50/60">
              <th className="font-medium px-5 py-2.5">Tanggal</th>
              <th className="font-medium px-5 py-2.5">No. Nota Dinas</th>
              <th className="font-medium px-5 py-2.5">Uraian</th>
              <th className="font-medium px-5 py-2.5">Jumlah</th>
              <th className="font-medium px-5 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {(pengajuanTerbaru ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-slate-400 text-sm">
                  Belum ada pengajuan. Mulai dari menu "Pengajuan Belanja".
                </td>
              </tr>
            )}
            {(pengajuanTerbaru ?? []).map((row: any) => (
              <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">{row.tanggal}</td>
                <td className="px-5 py-3 text-slate-500 font-mono text-xs">{row.nomor_nota_dinas || row.nomor_bukti || "-"}</td>
                <td className="px-5 py-3 text-slate-700 max-w-md truncate">{row.uraian_kegiatan}</td>
                <td className="px-5 py-3 text-slate-700 whitespace-nowrap">Rp {formatRupiah(row.jumlah_pengajuan)}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${
                      statusStyle[row.status] ?? statusStyle.draft
                    }`}
                  >
                    {statusLabel[row.status] ?? row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-900 mb-2">Laporan Realisasi</p>
        <div className="flex flex-wrap gap-1.5 border-b border-slate-200 mb-0 pb-px">
          {LAPORAN_TABS.map((t) => (
            <Link
              key={t.key}
              href={`/?laporan=${t.key}`}
              className={`flex items-center gap-1.5 text-sm px-3 py-2 -mb-px rounded-t-lg border border-b-0 transition-colors ${
                by === t.key
                  ? `${t.active} font-medium`
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${by === t.key ? t.dot : "bg-slate-300"}`} />
              {t.label}
            </Link>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 border-t-0 rounded-t-none overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100 bg-slate-50/60">
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
              {sortedLaporanRows.map((r) => {
                const pctSerapan = r.pagu > 0 ? (r.realisasi / r.pagu) * 100 : 0;
                return (
                  <tr key={r.key} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-700">{r.key}</td>
                    {showPagu && <td className="px-4 py-3 text-right text-slate-600">Rp {formatRupiah(r.pagu)}</td>}
                    <td className="px-4 py-3 text-right text-slate-600">Rp {formatRupiah(r.realisasi)}</td>
                    {showPagu && (
                      <td className="px-4 py-3 text-right text-slate-600">Rp {formatRupiah(r.pagu - r.realisasi)}</td>
                    )}
                    {showPagu && (
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center justify-center min-w-[3.2rem] px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${
                            pctSerapan >= 90
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : pctSerapan >= 50
                              ? "bg-amber-50 text-amber-700 ring-amber-200"
                              : "bg-slate-100 text-slate-600 ring-slate-200"
                          }`}
                        >
                          {pctSerapan.toFixed(1)}%
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {sortedLaporanRows.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-200 font-medium bg-slate-50/60">
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
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
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
