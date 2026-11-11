"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis,
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, BarChart,
} from "recharts";
import { AlertTriangle, CheckCircle2, Info, ArrowUpRight } from "lucide-react";

// ------------------------------------------------------------------ tipe
export type Grup = { nama: string; pagu: number; realisasi: number };
export type DashboardData = {
  tahun: number;
  tahapan: string;
  totalPagu: number;
  totalRealisasi: number;
  /** persen tahun anggaran yang sudah berlalu (0-100) */
  persenWaktu: number;
  bulanan: { label: string; realisasi: number }[];
  triwulan: { label: string; kas: number | null; realisasi: number }[];
  adaKas: boolean;
  status: { key: string; label: string; jumlah: number; warna: string }[];
  grup: { pptk: Grup[]; kegiatan: Grup[]; subkegiatan: Grup[] };
  komposisi: { kelompok: { nama: string; nilai: number }[]; sumber: { nama: string; nilai: number }[] };
  perhatian: { tingkat: "merah" | "kuning" | "biru"; teks: string; href: string }[];
};

// --------------------------------------------------------------- utilitas
const RP = new Intl.NumberFormat("id-ID");
const rp = (n: number) => `Rp ${RP.format(Math.round(n))}`;
/** 1,25 M (miliar) / 350 Jt (juta) -- agar muat di sumbu & kartu kecil */
function ringkas(n: number): string {
  const a = Math.abs(n);
  const f = (v: number, s: string) => `${(v).toLocaleString("id-ID", { maximumFractionDigits: v >= 100 ? 0 : v >= 10 ? 1 : 2 })} ${s}`;
  if (a >= 1e12) return f(n / 1e12, "T");
  if (a >= 1e9) return f(n / 1e9, "M");
  if (a >= 1e6) return f(n / 1e6, "Jt");
  if (a >= 1e3) return f(n / 1e3, "Rb");
  return String(Math.round(n));
}
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const PALET = ["#237469", "#4eab9b", "#d6f24b", "#0e7490", "#7fc8ba", "#f59e0b", "#6366f1", "#94a3b8"];

function Panel({ judul, sub, aksi, children, kelas = "" }: { judul: string; sub?: string; aksi?: React.ReactNode; children: React.ReactNode; kelas?: string }) {
  return (
    <section className={`bg-white rounded-2xl border border-slate-200/80 shadow-soft p-5 ${kelas}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{judul}</h2>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
        {aksi}
      </div>
      {children}
    </section>
  );
}

function Seg<T extends string>({ nilai, pilihan, onUbah }: { nilai: T; pilihan: { v: T; l: string }[]; onUbah: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs" role="tablist">
      {pilihan.map((p) => (
        <button key={p.v} type="button" role="tab" aria-selected={nilai === p.v} onClick={() => onUbah(p.v)}
          className={`px-2.5 py-1 rounded-md transition-colors ${nilai === p.v ? "bg-white text-brand-700 font-medium shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
          {p.l}
        </button>
      ))}
    </div>
  );
}

const Kosong = ({ teks = "Belum ada data untuk ditampilkan." }: { teks?: string }) => (
  <div className="h-48 flex items-center justify-center text-sm text-slate-400 text-center px-6">{teks}</div>
);

function TooltipRp({ active, payload, label, persenKey }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-slate-800 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <b className="text-slate-900">{p.dataKey === persenKey ? `${Number(p.value).toFixed(1)}%` : rp(p.value)}</b>
        </p>
      ))}
    </div>
  );
}

// =================================================================
// 1. GAUGE SERAPAN vs LAJU WAKTU
// =================================================================
function GaugeSerapan({ d }: { d: DashboardData }) {
  const serapan = pct(d.totalRealisasi, d.totalPagu);
  const waktu = d.persenWaktu;
  const selisih = serapan - waktu;
  const data = [
    { name: "Waktu berlalu", value: Math.min(100, waktu), fill: "#cbd5e1" },
    { name: "Serapan", value: Math.min(100, serapan), fill: serapan >= waktu - 10 ? "#237469" : "#f59e0b" },
  ];
  const vonis = d.totalPagu === 0
    ? { t: "Belum ada pagu", c: "text-slate-500 bg-slate-100" }
    : selisih >= -10
    ? { t: "Sesuai laju waktu", c: "text-emerald-700 bg-emerald-50" }
    : { t: `Tertinggal ${Math.abs(selisih).toFixed(0)} poin dari laju waktu`, c: "text-amber-700 bg-amber-50" };
  return (
    <Panel judul="Serapan Anggaran" sub={`Realisasi dibanding pagu dan laju waktu TA ${d.tahun}`}>
      <div className="relative h-52">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="62%" outerRadius="100%" data={data} startAngle={90} endAngle={-270} barSize={14}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" background={{ fill: "#f1f5f9" }} cornerRadius={8} isAnimationActive />
            <Tooltip content={({ payload }: any) => payload?.length ? (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-card">{payload[0].payload.name}: <b>{Number(payload[0].value).toFixed(1)}%</b></div>) : null} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="font-serif text-3xl text-slate-900">{serapan.toFixed(1)}%</p>
          <p className="text-[11px] text-slate-500">terserap</p>
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 text-xs text-slate-500 -mt-1">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: data[1].fill }} /> Serapan {serapan.toFixed(1)}%</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-slate-300" /> Waktu berlalu {waktu.toFixed(0)}%</span>
      </div>
      <p className={`mt-3 text-center text-xs font-medium rounded-full px-3 py-1 w-fit mx-auto ${vonis.c}`}>{vonis.t}</p>
    </Panel>
  );
}

// =================================================================
// 2. TREN REALISASI (bulanan kumulatif / triwulan vs anggaran kas)
// =================================================================
function TrenRealisasi({ d }: { d: DashboardData }) {
  const [mode, setMode] = useState<"bulan" | "triwulan">("bulan");
  const bulan = useMemo(() => {
    let kum = 0;
    return d.bulanan.map((b, i) => {
      kum += b.realisasi;
      return { label: b.label, realisasi: b.realisasi, kumulatif: pct(kum, d.totalPagu), ideal: ((i + 1) / 12) * 100 };
    });
  }, [d]);
  const adaData = d.totalRealisasi > 0 || d.adaKas;
  return (
    <Panel
      judul="Tren Realisasi" kelas="lg:col-span-2"
      sub={mode === "bulan" ? "Batang = realisasi per bulan; garis = kumulatif terhadap pagu vs laju ideal" : "Rencana anggaran kas vs realisasi per triwulan"}
      aksi={<Seg nilai={mode} onUbah={setMode} pilihan={[{ v: "bulan", l: "Per bulan" }, { v: "triwulan", l: "Per triwulan" }]} />}
    >
      {!adaData ? <Kosong teks="Belum ada realisasi (pengajuan berstatus Dicairkan)." /> : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {mode === "bulan" ? (
              <ComposedChart data={bulan} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="l" tickFormatter={ringkas} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={52} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={42} />
                <Tooltip content={<TooltipRp persenKey="kumulatif" />} cursor={{ fill: "rgba(35,116,105,0.06)" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="l" dataKey="realisasi" name="Realisasi bulan ini" fill="#4eab9b" radius={[6, 6, 0, 0]} maxBarSize={32} />
                <Line yAxisId="r" type="monotone" dataKey="kumulatif" name="Kumulatif (% pagu)" stroke="#237469" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line yAxisId="r" type="linear" dataKey="ideal" name="Laju ideal" stroke="#94a3b8" strokeDasharray="5 4" strokeWidth={1.5} dot={false} />
              </ComposedChart>
            ) : (
              <BarChart data={d.triwulan} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={ringkas} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={52} />
                <Tooltip content={<TooltipRp />} cursor={{ fill: "rgba(35,116,105,0.06)" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                {d.adaKas && <Bar dataKey="kas" name="Rencana kas" fill="#cbd5e1" radius={[6, 6, 0, 0]} maxBarSize={40} />}
                <Bar dataKey="realisasi" name="Realisasi" fill="#237469" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {mode === "triwulan" && !d.adaKas && <p className="text-xs text-slate-400 mt-2">Isi menu Anggaran Kas untuk menampilkan rencana kas per triwulan.</p>}
    </Panel>
  );
}

// =================================================================
// 3. DONUT STATUS PENGAJUAN (klik = buka daftar)
// =================================================================
function DonutStatus({ d }: { d: DashboardData }) {
  const router = useRouter();
  const total = d.status.reduce((s, x) => s + x.jumlah, 0);
  const [aktif, setAktif] = useState<number | null>(null);
  const data = d.status.filter((s) => s.jumlah > 0);
  return (
    <Panel judul="Status Pengajuan" sub="Klik bagian donat atau daftar untuk membuka dokumennya">
      {total === 0 ? <Kosong teks="Belum ada pengajuan pada periode ini." /> : (
        <>
          <div className="relative h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="jumlah" nameKey="label" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none"
                  onMouseEnter={(_, i) => setAktif(i)} onMouseLeave={() => setAktif(null)}
                  onClick={(e: any) => router.push(`/pengajuan?status=${e.key}`)} cursor="pointer">
                  {data.map((s, i) => <Cell key={s.key} fill={s.warna} opacity={aktif === null || aktif === i ? 1 : 0.45} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="font-serif text-2xl text-slate-900">{aktif !== null ? data[aktif].jumlah : total}</p>
              <p className="text-[11px] text-slate-500">{aktif !== null ? data[aktif].label : "dokumen"}</p>
            </div>
          </div>
          <ul className="mt-2 space-y-1">
            {d.status.map((s) => (
              <li key={s.key}>
                <Link href={`/pengajuan?status=${s.key}`} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-slate-50">
                  <i className="h-2.5 w-2.5 rounded-full" style={{ background: s.warna }} />
                  <span className="flex-1 text-slate-600">{s.label}</span>
                  <b className="text-slate-900">{s.jumlah}</b>
                  <span className="w-9 text-right text-slate-400">{total ? Math.round((s.jumlah / total) * 100) : 0}%</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

// =================================================================
// 4. KOMPOSISI PAGU (kelompok belanja / sumber dana)
// =================================================================
function KomposisiPagu({ d }: { d: DashboardData }) {
  const [by, setBy] = useState<"kelompok" | "sumber">("kelompok");
  const [aktif, setAktif] = useState<number | null>(null);
  const data = d.komposisi[by].filter((x) => x.nilai > 0);
  const total = data.reduce((s, x) => s + x.nilai, 0);
  const a = aktif !== null ? data[aktif] : null;
  return (
    <Panel judul="Komposisi Pagu" sub="Arahkan kursor pada bagian donat untuk rinciannya"
      aksi={<Seg nilai={by} onUbah={(v) => { setBy(v); setAktif(null); }} pilihan={[{ v: "kelompok", l: "Kelompok" }, { v: "sumber", l: "Sumber dana" }]} />}>
      {total === 0 ? <Kosong teks="Belum ada pagu." /> : (
        <>
          <div className="relative h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="nilai" nameKey="nama" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none"
                  onMouseEnter={(_, i) => setAktif(i)} onMouseLeave={() => setAktif(null)}>
                  {data.map((s, i) => <Cell key={s.nama} fill={PALET[i % PALET.length]} opacity={aktif === null || aktif === i ? 1 : 0.4} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-8 text-center">
              <p className="font-serif text-lg text-slate-900 leading-tight">{a ? `${((a.nilai / total) * 100).toFixed(1)}%` : `Rp ${ringkas(total)}`}</p>
              <p className="text-[11px] text-slate-500 line-clamp-2">{a ? a.nama : "total pagu"}</p>
            </div>
          </div>
          <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {data.map((s, i) => (
              <li key={s.nama} onMouseEnter={() => setAktif(i)} onMouseLeave={() => setAktif(null)}
                className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs ${aktif === i ? "bg-slate-50" : ""}`}>
                <i className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PALET[i % PALET.length] }} />
                <span className="flex-1 truncate text-slate-600" title={s.nama}>{s.nama}</span>
                <b className="text-slate-900">Rp {ringkas(s.nilai)}</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

// =================================================================
// 5. PERLU PERHATIAN
// =================================================================
function Perhatian({ d }: { d: DashboardData }) {
  const gaya = {
    merah: { wrap: "border-rose-200 bg-rose-50/70 text-rose-800", Ikon: AlertTriangle },
    kuning: { wrap: "border-amber-200 bg-amber-50/70 text-amber-800", Ikon: AlertTriangle },
    biru: { wrap: "border-sky-200 bg-sky-50/70 text-sky-800", Ikon: Info },
  } as const;
  return (
    <Panel judul="Perlu Perhatian" sub="Hal yang butuh tindak lanjut pada periode ini">
      {d.perhatian.length === 0 ? (
        <div className="h-44 flex flex-col items-center justify-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-8 w-8" /> Tidak ada hal mendesak.
        </div>
      ) : (
        <ul className="space-y-2">
          {d.perhatian.map((p, i) => {
            const g = gaya[p.tingkat];
            return (
              <li key={i}>
                <Link href={p.href} className={`group flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs transition-shadow hover:shadow-md ${g.wrap}`}>
                  <g.Ikon className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="flex-1">{p.teks}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// =================================================================
// 6. PERINGKAT SERAPAN (PPTK / Kegiatan / Sub Kegiatan)
// =================================================================
function Peringkat({ d }: { d: DashboardData }) {
  const [grup, setGrup] = useState<"pptk" | "kegiatan" | "subkegiatan">("pptk");
  const [urut, setUrut] = useState<"pagu" | "realisasi" | "serapan">("pagu");
  const [semua, setSemua] = useState(false);
  const rows = useMemo(() => {
    const r = d.grup[grup].map((x) => ({ ...x, serapan: pct(x.realisasi, x.pagu) }));
    r.sort((a, b) => (urut === "serapan" ? b.serapan - a.serapan : b[urut] - a[urut]));
    return r;
  }, [d, grup, urut]);
  const maks = Math.max(1, ...rows.map((r) => Math.max(r.pagu, r.realisasi)));
  const tampil = semua ? rows : rows.slice(0, 8);
  const warna = (p: number) => (p >= 90 ? "bg-emerald-50 text-emerald-700" : p >= 50 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600");
  return (
    <Panel judul="Peringkat Serapan" sub="Batang abu = pagu, batang hijau = realisasi. Arahkan kursor untuk angka lengkap."
      aksi={
        <div className="flex flex-wrap gap-2">
          <Seg nilai={grup} onUbah={(v) => { setGrup(v); setSemua(false); }} pilihan={[{ v: "pptk", l: "PPTK" }, { v: "kegiatan", l: "Kegiatan" }, { v: "subkegiatan", l: "Sub Kegiatan" }]} />
          <Seg nilai={urut} onUbah={setUrut} pilihan={[{ v: "pagu", l: "Urut pagu" }, { v: "realisasi", l: "Urut realisasi" }, { v: "serapan", l: "Urut %" }]} />
        </div>
      }>
      {rows.length === 0 ? <Kosong /> : (
        <>
          <ul className="space-y-2.5">
            {tampil.map((r) => (
              <li key={r.nama} className="group" title={`${r.nama}\nPagu ${rp(r.pagu)}\nRealisasi ${rp(r.realisasi)}\nSisa ${rp(r.pagu - r.realisasi)}`}>
                <div className="flex items-center gap-3 text-xs">
                  <span className="w-44 sm:w-64 shrink-0 truncate text-slate-700">{r.nama}</span>
                  <div className="relative flex-1 h-5 rounded-md bg-slate-100 overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-slate-300/80" style={{ width: `${(r.pagu / maks) * 100}%` }} />
                    <div className={`absolute inset-y-1 left-0 rounded-sm transition-all duration-500 ${r.realisasi > r.pagu ? "bg-rose-500" : "bg-brand-600"}`} style={{ width: `${(r.realisasi / maks) * 100}%` }} />
                  </div>
                  <span className="w-20 shrink-0 text-right text-slate-500 hidden sm:block">Rp {ringkas(r.realisasi)}</span>
                  <span className={`w-14 shrink-0 text-center rounded-full px-1.5 py-0.5 font-medium ${r.realisasi > r.pagu ? "bg-rose-50 text-rose-700" : warna(r.serapan)}`}>{r.serapan.toFixed(1)}%</span>
                </div>
              </li>
            ))}
          </ul>
          {rows.length > 8 && (
            <button type="button" onClick={() => setSemua((v) => !v)} className="mt-3 text-xs text-brand-700 hover:underline">
              {semua ? "Tampilkan 8 teratas" : `Tampilkan semua (${rows.length})`}
            </button>
          )}
        </>
      )}
    </Panel>
  );
}

// ================================================================= utama
export default function DashboardCharts({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-3 gap-5">
        <GaugeSerapan d={data} />
        <TrenRealisasi d={data} />
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <DonutStatus d={data} />
        <KomposisiPagu d={data} />
        <Perhatian d={data} />
      </div>
      <Peringkat d={data} />
    </div>
  );
}
