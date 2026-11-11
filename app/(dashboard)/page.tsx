import { ambilSemua } from "@/lib/anggaran/muat";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/terbilang";
import { getPeriode, tahapanLabel, tahapanUpTo } from "@/lib/periode";
import { Wallet, Receipt, FileSpreadsheet, ClipboardList } from "lucide-react";
import Link from "next/link";
import DashboardCharts, { type DashboardData, type Grup } from "@/components/DashboardCharts";

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

export default async function DashboardPage(props: { searchParams: Promise<{ laporan?: string }> }) {
  const searchParams = await props.searchParams;
  const { tahun, tahapan } = await getPeriode();
  const supabase = await createClient();

  // PERFORMA: keenam query di bawah tidak saling bergantung -> dijalankan
  // BERSAMAAN (Promise.all). Sebelumnya dijalankan satu per satu sehingga
  // waktu muat dashboard = jumlah seluruh latensi ke database.
  const bulanIni = new Date();
  const awalBulan = new Date(bulanIni.getFullYear(), bulanIni.getMonth(), 1).toISOString();

  const [
    { data: rekap },
    { data: pengajuanTerbaru },
    { count: pengajuanBulanIni },
    { data: statusRows },
    { data: dpaList },
    { data: realisasiList },
    kasRows,
  ] = await Promise.all([
    ambilSemua<any>((a, b) =>
      supabase.from("rekap_realisasi").select("dpa_id, pagu_anggaran, total_realisasi")
        .eq("tahun_anggaran", tahun).eq("tahapan", tahapan).order("dpa_id").range(a, b)
    ).then((data) => ({ data })),
    // Diurutkan berdasarkan tanggal transaksi/Nota Dinas terbaru, lalu created_at.
    supabase
      .from("pengajuan_belanja")
      .select(
        "id, nomor_bukti, nomor_nota_dinas, tanggal, uraian_kegiatan, jumlah_pengajuan, status, created_at, dpa:dpa!inner(tahun_anggaran, tahapan)"
      )
      .eq("dpa.tahun_anggaran", tahun)
      .eq("dpa.tahapan", tahapan)
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("pengajuan_belanja")
      .select("id, dpa:dpa!inner(tahun_anggaran, tahapan)", { count: "exact", head: true })
      .eq("dpa.tahun_anggaran", tahun)
      .eq("dpa.tahapan", tahapan)
      .gte("created_at", awalBulan),
    ambilSemua<any>((a, b) =>
      supabase.from("pengajuan_belanja").select("id, status, dpa:dpa!inner(tahun_anggaran, tahapan)")
        .eq("dpa.tahun_anggaran", tahun).eq("dpa.tahapan", tahapan).order("id").range(a, b)
    ).then((data) => ({ data })),
    ambilSemua<any>((a, b) =>
      supabase.from("dpa")
        .select("id, pagu_anggaran, pptk:pejabat_skpd(nama), rekening:rekening_belanja(kelompok_belanja, sumber_dana, sub_kegiatan:sub_kegiatan(nama_sub_kegiatan, kegiatan:kegiatan(nama_kegiatan)))")
        .eq("tahun_anggaran", tahun).eq("tahapan", tahapan).order("id").range(a, b)
    ).then((data) => ({ data })),
    ambilSemua<any>((a, b) =>
      supabase.from("pengajuan_belanja")
        .select("id, tanggal, jumlah_pengajuan, dpa_id, dpa:dpa!inner(tahun_anggaran, tahapan, pptk:pejabat_skpd(nama), rekening:rekening_belanja(sub_kegiatan:sub_kegiatan(nama_sub_kegiatan, kegiatan:kegiatan(nama_kegiatan))))")
        .eq("dpa.tahun_anggaran", tahun).in("dpa.tahapan", tahapanUpTo(tahapan)).eq("status", "dicairkan").order("id").range(a, b)
    ).then((data) => ({ data })),
    // Rencana anggaran kas per triwulan (opsional: tabel bisa belum ada)
    ambilSemua<any>((a, b) =>
      supabase.from("anggaran_kas").select("tw1, tw2, tw3, tw4, dpa:dpa!inner(tahun_anggaran, tahapan)")
        .eq("dpa.tahun_anggaran", tahun).eq("dpa.tahapan", tahapan).order("id").range(a, b)
    ).catch(() => null),
  ]);

  const totalPagu = (rekap ?? []).reduce((s, r: any) => s + Number(r.pagu_anggaran || 0), 0);
  const totalRealisasi = (rekap ?? []).reduce((s, r: any) => s + Number(r.total_realisasi || 0), 0);
  const totalSisa = totalPagu - totalRealisasi;

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

  type LaporanRow = { key: string; pagu: number; realisasi: number };
  const laporanRows = new Map<string, LaporanRow>();
  function bump(key: string, field: "pagu" | "realisasi", value: number) {
    const existing = laporanRows.get(key) ?? { key, pagu: 0, realisasi: 0 };
    existing[field] += value;
    laporanRows.set(key, existing);
  }

  const SEMUA_GRUP: ("pptk" | "kegiatan" | "subkegiatan")[] = ["pptk", "kegiatan", "subkegiatan"];
  const namaGrup = (g: "pptk" | "kegiatan" | "subkegiatan", dpaRow: any) => {
    const rek: any = dpaRow?.rekening;
    return g === "pptk"
      ? dpaRow?.pptk?.nama || "-- Belum ada PPTK --"
      : g === "kegiatan"
      ? rek?.sub_kegiatan?.kegiatan?.nama_kegiatan || "-- Tidak diketahui --"
      : rek?.sub_kegiatan?.nama_sub_kegiatan || "-- Tidak diketahui --";
  };
  const bangunGrup = (g: "pptk" | "kegiatan" | "subkegiatan"): Grup[] => {
    const m = new Map<string, Grup>();
    const ambil = (k: string) => m.get(k) ?? (m.set(k, { nama: k, pagu: 0, realisasi: 0 }), m.get(k)!);
    for (const d of dpaList ?? []) ambil(namaGrup(g, d)).pagu += Number((d as any).pagu_anggaran || 0);
    for (const p of realisasiList ?? []) ambil(namaGrup(g, (p as any).dpa)).realisasi += Number((p as any).jumlah_pengajuan || 0);
    return Array.from(m.values());
  };
  const grupSemua = Object.fromEntries(SEMUA_GRUP.map((g) => [g, bangunGrup(g)])) as Record<"pptk" | "kegiatan" | "subkegiatan", Grup[]>;

  if (by === "pptk" || by === "kegiatan" || by === "subkegiatan") {
    for (const g of grupSemua[by]) laporanRows.set(g.nama, { key: g.nama, pagu: g.pagu, realisasi: g.realisasi });
  } else {
    for (const p of realisasiList ?? []) {
      const bulanKe = Math.min(11, Math.max(0, Number(String((p as any).tanggal).slice(5, 7)) - 1));
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

  // -----------------------------------------------------------------
  // Data untuk grafik interaktif (komponen klien DashboardCharts)
  // -----------------------------------------------------------------
  const sekarang = Date.now();
  const awalTA = new Date(tahun, 0, 1).getTime();
  const akhirTA = new Date(tahun + 1, 0, 1).getTime();
  const persenWaktu = Math.min(100, Math.max(0, ((sekarang - awalTA) / (akhirTA - awalTA)) * 100));

  const perBulan = new Array(12).fill(0) as number[];
  for (const p of realisasiList ?? []) {
    const b = Math.min(11, Math.max(0, Number(String((p as any).tanggal).slice(5, 7)) - 1));
    perBulan[b] += Number((p as any).jumlah_pengajuan || 0);
  }
  const adaKas = Array.isArray(kasRows) && kasRows.length > 0;
  const kasTw = [0, 0, 0, 0];
  for (const k of kasRows ?? []) ["tw1", "tw2", "tw3", "tw4"].forEach((c, i) => (kasTw[i] += Number((k as any)[c] || 0)));

  const kelompok = new Map<string, number>();
  const sumber = new Map<string, number>();
  for (const d of dpaList ?? []) {
    const rek: any = (d as any).rekening;
    const v = Number((d as any).pagu_anggaran || 0);
    const k1 = String(rek?.kelompok_belanja || "Belum diisi");
    const k2 = String(rek?.sumber_dana || "Belum diisi");
    kelompok.set(k1, (kelompok.get(k1) ?? 0) + v);
    sumber.set(k2, (sumber.get(k2) ?? 0) + v);
  }
  const keArray = (m: Map<string, number>) => Array.from(m, ([nama, nilai]) => ({ nama, nilai })).sort((a, b) => b.nilai - a.nilai);

  const melebihiPagu = (rekap ?? []).filter((r: any) => Number(r.total_realisasi || 0) > Number(r.pagu_anggaran || 0) + 0.005).length;
  const tanpaPptk = (dpaList ?? []).filter((d: any) => !d.pptk).length;
  const perhatian: DashboardData["perhatian"] = [];
  if (melebihiPagu > 0) perhatian.push({ tingkat: "merah", teks: `${melebihiPagu} belanja realisasinya melebihi pagu — periksa Rekap Realisasi.`, href: "/rekap" });
  if (rekapStatusCount.diajukan > 0) perhatian.push({ tingkat: "kuning", teks: `${rekapStatusCount.diajukan} pengajuan menunggu persetujuan.`, href: "/pengajuan?status=diajukan" });
  if (rekapStatusCount.disetujui > 0) perhatian.push({ tingkat: "biru", teks: `${rekapStatusCount.disetujui} pengajuan sudah disetujui, belum dicairkan.`, href: "/pengajuan?status=disetujui" });
  if (rekapStatusCount.draft > 0) perhatian.push({ tingkat: "biru", teks: `${rekapStatusCount.draft} draft pengajuan belum diajukan.`, href: "/pengajuan?status=draft" });
  if (tanpaPptk > 0) perhatian.push({ tingkat: "kuning", teks: `${tanpaPptk} belanja belum memiliki PPTK.`, href: "/rekening" });

  const dashboardData: DashboardData = {
    tahun, tahapan: tahapanLabel(tahapan), totalPagu, totalRealisasi, persenWaktu,
    bulanan: NAMA_BULAN.map((n, i) => ({ label: n.slice(0, 3), realisasi: perBulan[i] })),
    triwulan: [0, 1, 2, 3].map((i) => ({
      label: `TW ${i + 1}`,
      kas: adaKas ? kasTw[i] : null,
      realisasi: perBulan.slice(i * 3, i * 3 + 3).reduce((x, y) => x + y, 0),
    })),
    adaKas,
    status: [
      { key: "draft", label: "Draft", jumlah: rekapStatusCount.draft, warna: "#94a3b8" },
      { key: "diajukan", label: "Diajukan", jumlah: rekapStatusCount.diajukan, warna: "#f59e0b" },
      { key: "disetujui", label: "Disetujui", jumlah: rekapStatusCount.disetujui, warna: "#10b981" },
      { key: "dicairkan", label: "Dicairkan", jumlah: rekapStatusCount.dicairkan, warna: "#0ea5e9" },
      { key: "ditolak", label: "Ditolak", jumlah: rekapStatusCount.ditolak, warna: "#f43f5e" },
    ],
    grup: grupSemua,
    komposisi: { kelompok: keArray(kelompok), sumber: keArray(sumber) },
    perhatian,
  };

  return (
    <div className="space-y-7">
      <div className="rounded-2xl bg-gradient-to-br from-ink-900 via-ink-800 to-brand-800 px-7 py-7 text-white shadow-card relative overflow-hidden">
        <div className="absolute -right-10 -top-16 h-52 w-52 rounded-full bg-brand-400/10" />
        <h1 className="font-serif text-2xl relative">Selamat datang kembali</h1>
        <p className="text-sm text-slate-300 mt-1 relative">
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

      <DashboardCharts data={dashboardData} />

      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-x-auto shadow-soft">
        <div className="p-5 pb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-900">Pengajuan Terbaru</p>
          <p className="text-xs text-slate-400">Diurutkan berdasarkan tanggal Nota Dinas terbaru</p>
        </div>
        <table className="w-full text-sm min-w-[640px]">
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

        <div className="bg-white rounded-xl border border-slate-200/80 border-t-0 rounded-t-none overflow-x-auto shadow-soft">
          <table className="w-full text-sm min-w-[640px]">
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
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-soft hover:shadow-card transition-shadow">
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
