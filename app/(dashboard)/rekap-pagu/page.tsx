import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPeriode } from "@/lib/periode";
import { ambilSemua } from "@/lib/anggaran/muat";
import { statusAntarTahapan } from "@/lib/anggaran/periksa";
import type { TahapanKey } from "@/lib/anggaran/pagu";

type Pagu = { murni: number; pergeseran: number; perubahan: number; baru: number; hilang: number };
const kosong = (): Pagu => ({ murni: 0, pergeseran: 0, perubahan: 0, baru: 0, hilang: 0 });
const rp = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
const tambah = (a: Pagu, b: Pagu) => { a.murni += b.murni; a.pergeseran += b.pergeseran; a.perubahan += b.perubahan; a.baru += b.baru; a.hilang += b.hilang; };

function Sel({ n }: { n: number }) {
  return <span className={n < 0 ? "text-rose-600" : n > 0 ? "text-emerald-700" : "text-slate-400"}>{n > 0 ? "+" : ""}{rp(n)}</span>;
}

export default async function RekapPaguPage() {
  const { tahun, tahapan } = await getPeriode();
  const supabase = await createClient();
  const rows = await ambilSemua<any>((a, b) =>
    supabase.from("dpa")
      .select("rekening_id, tahapan, pagu_anggaran, rekening:rekening_belanja(sub_kegiatan:sub_kegiatan(id, kode_sub_kegiatan, nama_sub_kegiatan, kegiatan:kegiatan(id, kode_kegiatan, nama_kegiatan, program:program(id, kode_program, nama_program))))")
      .eq("tahun_anggaran", tahun).order("id").range(a, b)
  );

  // Status "baru"/"tidak dibawa" per rekening -- aturan SAMA dengan halaman rincian (statusAntarTahapan)
  const paguPer = new Map<string, Partial<Record<TahapanKey, number>>>();
  for (const r of rows) {
    const m = paguPer.get(r.rekening_id) ?? {};
    m[r.tahapan as TahapanKey] = Number(r.pagu_anggaran || 0);
    paguPer.set(r.rekening_id, m);
  }
  const statusRek = new Map([...paguPer].map(([id, p]) => [id, statusAntarTahapan(p)] as const));
  const sudahDihitung = new Set<string>();

  type Sub = { id: string; kode: string; nama: string; p: Pagu };
  type Keg = { kode: string; nama: string; p: Pagu; subs: Map<string, Sub> };
  type Prog = { kode: string; nama: string; p: Pagu; kegs: Map<string, Keg> };
  const progs = new Map<string, Prog>();

  for (const r of rows) {
    const sk = r.rekening?.sub_kegiatan, kg = sk?.kegiatan, pg = kg?.program;
    if (!sk || !kg || !pg) continue;
    const pr = progs.get(pg.id) ?? { kode: pg.kode_program, nama: pg.nama_program, p: kosong(), kegs: new Map() };
    progs.set(pg.id, pr);
    const ke = pr.kegs.get(kg.id) ?? { kode: kg.kode_kegiatan, nama: kg.nama_kegiatan, p: kosong(), subs: new Map() };
    pr.kegs.set(kg.id, ke);
    const su = ke.subs.get(sk.id) ?? { id: sk.id, kode: sk.kode_sub_kegiatan, nama: sk.nama_sub_kegiatan, p: kosong() };
    ke.subs.set(sk.id, su);
    const v = Number(r.pagu_anggaran || 0);
    if (r.tahapan === "murni") su.p.murni += v;
    else if (r.tahapan === "pergeseran") su.p.pergeseran += v;
    else if (r.tahapan === "perubahan") su.p.perubahan += v;
    if (!sudahDihitung.has(r.rekening_id)) {
      sudahDihitung.add(r.rekening_id);
      const st = statusRek.get(r.rekening_id);
      if (st?.baruDi) su.p.baru += 1;
      if (st?.hilangDi) su.p.hilang += 1;
    }
  }
  const urut = <T extends { kode: string }>(m: Map<string, T>) => [...m.values()].sort((a, b) => a.kode.localeCompare(b.kode));
  const total = kosong();
  for (const pr of progs.values()) {
    for (const ke of pr.kegs.values()) { for (const su of ke.subs.values()) tambah(ke.p, su.p); tambah(pr.p, ke.p); }
    tambah(total, pr.p);
  }

  const Baris = ({ kode, nama, p, level, subId }: { kode: string; nama: string; p: Pagu; level: 0 | 1 | 2; subId?: string }) => (
    <tr className={`border-b border-slate-50 ${level === 0 ? "bg-slate-50 font-semibold" : level === 1 ? "font-medium" : ""}`}>
      <td className="px-3 py-2" style={{ paddingLeft: 12 + level * 20 }}>
        <span className="font-mono text-[11px] text-slate-400 mr-2">{kode}</span>{nama}
        {level === 2 && p.baru > 0 && <Link href={`/rekap-pagu/rincian?status=baru&sub=${subId}`} className="ml-2 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] hover:bg-emerald-100" title="Lihat rekening mana yang baru">{p.baru} belanja baru →</Link>}
        {level === 2 && p.hilang > 0 && <Link href={`/rekap-pagu/rincian?status=hilang&sub=${subId}`} className="ml-2 rounded-full bg-rose-50 text-rose-700 px-2 py-0.5 text-[10px] hover:bg-rose-100" title="Ada di tahapan sebelumnya tetapi tidak di tahapan berikutnya">{p.hilang} tidak dibawa →</Link>}
      </td>
      <td className="px-3 py-2 text-right">{rp(p.murni)}</td>
      <td className="px-3 py-2 text-right">{rp(p.pergeseran)}</td>
      <td className="px-3 py-2 text-right">{rp(p.perubahan)}</td>
      <td className="px-3 py-2 text-right"><Sel n={p.perubahan - p.pergeseran} /></td>
    </tr>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Perbandingan Pagu Antartahapan</h1>
        <p className="page-sub">
          Tahun Anggaran {tahun}: pagu per Program, Kegiatan, dan Sub Kegiatan pada Murni, Pergeseran, dan Perubahan. Selisih = Perubahan − Pergeseran.
          Periode aktif: <b>{tahapan}</b>. Ubah data lewat <Link className="underline" href="/rekening">Input Anggaran</Link> atau{" "}
          <Link className="underline" href="/rekening/import">impor Excel</Link>.
          Klik label hijau <b>&quot;belanja baru&quot;</b> / merah <b>&quot;tidak dibawa&quot;</b> untuk melihat rekening mana yang dimaksud, atau buka{" "}
          <Link className="underline" href="/rekap-pagu/rincian?status=baru">semua belanja baru</Link> dan{" "}
          <Link className="underline" href="/rekening/pemeriksaan">Pemeriksaan Data Pagu</Link>.
        </p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100">
            <th className="px-3 py-2.5 font-medium">Program / Kegiatan / Sub Kegiatan</th>
            <th className="px-3 py-2.5 font-medium text-right">Murni</th><th className="px-3 py-2.5 font-medium text-right">Pergeseran</th>
            <th className="px-3 py-2.5 font-medium text-right">Perubahan</th><th className="px-3 py-2.5 font-medium text-right">Selisih</th>
          </tr></thead>
          <tbody>
            {progs.size === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Belum ada data pagu pada tahun ini.</td></tr>}
            {urut(progs).map((pr) => (
              <FragmentRows key={pr.kode}>
                <Baris kode={pr.kode} nama={pr.nama} p={pr.p} level={0} />
                {urut(pr.kegs).map((ke) => (
                  <FragmentRows key={ke.kode}>
                    <Baris kode={ke.kode} nama={ke.nama} p={ke.p} level={1} />
                    {urut(ke.subs).map((su) => <Baris key={su.kode} kode={su.kode} nama={su.nama} p={su.p} level={2} subId={su.id} />)}
                  </FragmentRows>
                ))}
              </FragmentRows>
            ))}
          </tbody>
          <tfoot><tr className="border-t border-slate-300 font-semibold">
            <td className="px-3 py-2.5">TOTAL</td><td className="px-3 py-2.5 text-right">{rp(total.murni)}</td>
            <td className="px-3 py-2.5 text-right">{rp(total.pergeseran)}</td><td className="px-3 py-2.5 text-right">{rp(total.perubahan)}</td>
            <td className="px-3 py-2.5 text-right"><Sel n={total.perubahan - total.pergeseran} /></td>
          </tr></tfoot>
        </table>
      </div>
      <p className="text-xs text-slate-500">Belum ada pagu Perubahan? Di menu Input Anggaran pilih periode Perubahan lalu gunakan &quot;Salin dari tahapan lain&quot; (Pergeseran), kemudian sesuaikan atau impor Excel.</p>
    </div>
  );
}

function FragmentRows({ children }: { children: React.ReactNode }) { return <>{children}</>; }
