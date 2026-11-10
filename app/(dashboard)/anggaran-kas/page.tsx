import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPeriode, tahapanLabel, TAHAPAN_OPTIONS } from "@/lib/periode";
import { ambilSemua } from "@/lib/anggaran/muat";
import { simpanAnggaranKas, bagiRataKas, salinKasDariTahapan } from "./actions";
import { CheckCircle2, AlertTriangle } from "lucide-react";

const rp = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n * 100) / 100);

export default async function AnggaranKasPage(props: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await props.searchParams;
  const { tahun, tahapan } = await getPeriode();
  const supabase = await createClient();

  let rows: any[] = [];
  let tabelBelumAda = false;
  try {
    rows = await ambilSemua<any>((a, b) =>
      supabase.from("dpa")
        .select("id, pagu_anggaran, kas:anggaran_kas(tw1, tw2, tw3, tw4), rekening:rekening_belanja(kode_rekening, jenis_belanja, sumber_dana, sub_kegiatan:sub_kegiatan(kode_sub_kegiatan, nama_sub_kegiatan))")
        .eq("tahun_anggaran", tahun).eq("tahapan", tahapan).order("id").range(a, b)
    );
  } catch (e: any) {
    if (/anggaran_kas/.test(e?.message || "")) tabelBelumAda = true; else throw e;
  }
  rows = rows
    .map((r) => ({ ...r, kas: Array.isArray(r.kas) ? r.kas[0] ?? null : r.kas }))
    .sort((a, b) => `${a.rekening?.sub_kegiatan?.kode_sub_kegiatan}${a.rekening?.kode_rekening}`.localeCompare(`${b.rekening?.sub_kegiatan?.kode_sub_kegiatan}${b.rekening?.kode_rekening}`));

  const tw = (r: any) => [Number(r.kas?.tw1 || 0), Number(r.kas?.tw2 || 0), Number(r.kas?.tw3 || 0), Number(r.kas?.tw4 || 0)];
  const selisih = (r: any) => Math.round((tw(r).reduce((s, x) => s + x, 0) - Number(r.pagu_anggaran || 0)) * 100) / 100;
  const totalPagu = rows.reduce((s, r) => s + Number(r.pagu_anggaran || 0), 0);
  const totalTw = [0, 1, 2, 3].map((i) => rows.reduce((s, r) => s + tw(r)[i], 0));
  const tidakSesuai = rows.filter((r) => selisih(r) !== 0).length;
  const tahapanLain = TAHAPAN_OPTIONS.filter((t) => t.value !== tahapan);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Anggaran Kas per Belanja (Triwulanan)</h1>
        <p className="page-sub">Tahun Anggaran {tahun}, Tahapan {tahapanLabel(tahapan)}. Total TW1–TW4 setiap belanja sebaiknya sama dengan pagu; selisih diberi tanda. Ganti tahapan lewat menu periode untuk mengisi kas Perubahan.</p>
      </div>

      {sp.ok && <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> {sp.ok}</p>}
      {tabelBelumAda && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Tabel <code>anggaran_kas</code> belum ada. Jalankan migrasi <code>20260806000000_anggaran_kas.sql</code> di Supabase SQL Editor.</p>}

      {!tabelBelumAda && (
        <div className="flex flex-wrap items-center gap-3">
          <form action={bagiRataKas}><button className="btn-secondary" type="submit">Isi merata untuk yang masih kosong</button></form>
          {tahapanLain.length > 0 && (
            <form action={salinKasDariTahapan} className="flex items-center gap-2">
              <select name="dari_tahapan" className="field !w-auto" defaultValue={tahapanLain[0].value}>
                {tahapanLain.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <button className="btn-secondary" type="submit">Salin kas dari tahapan ini</button>
            </form>
          )}
          <span className="text-xs text-slate-500 flex items-center gap-1">
            {tidakSesuai > 0 ? <><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> {tidakSesuai} belanja belum sesuai pagu</> : rows.length > 0 ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> semua kas sesuai pagu</> : null}
          </span>
        </div>
      )}

      <form action={simpanAnggaranKas}>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="px-3 py-2.5 font-medium">Sub Kegiatan / Rekening</th>
              <th className="px-3 py-2.5 font-medium text-right">Pagu</th>
              {["TW I", "TW II", "TW III", "TW IV"].map((t) => <th key={t} className="px-2 py-2.5 font-medium text-right">{t}</th>)}
              <th className="px-3 py-2.5 font-medium text-right">Selisih</th>
            </tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Belum ada pagu pada tahapan ini.</td></tr>}
              {rows.map((r) => {
                const s = selisih(r), v = tw(r);
                return (
                  <tr key={r.id} className="border-b border-slate-50 align-top">
                    <td className="px-3 py-2">
                      <p className="text-slate-800">{r.rekening?.jenis_belanja}</p>
                      <p className="font-mono text-[11px] text-slate-400">{r.rekening?.kode_rekening} · {r.rekening?.sumber_dana}</p>
                      <p className="text-[11px] text-slate-400">{r.rekening?.sub_kegiatan?.nama_sub_kegiatan}</p>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{rp(Number(r.pagu_anggaran))}</td>
                    {v.map((x, i) => (
                      <td key={i} className="px-2 py-2">
                        <input type="number" min={0} step="0.01" name={`kas_${r.id}_${i + 1}`} defaultValue={x} className="field !w-32 text-right" />
                      </td>
                    ))}
                    <td className={`px-3 py-2 text-right whitespace-nowrap ${s === 0 ? "text-emerald-700" : "text-rose-600 font-medium"}`}>{s === 0 ? "sesuai" : (s > 0 ? "+" : "") + rp(s)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot><tr className="border-t border-slate-300 font-semibold">
              <td className="px-3 py-2.5">TOTAL</td><td className="px-3 py-2.5 text-right">{rp(totalPagu)}</td>
              {totalTw.map((x, i) => <td key={i} className="px-2 py-2.5 text-right">{rp(x)}</td>)}
              <td className="px-3 py-2.5 text-right">{rp(totalTw.reduce((a, b) => a + b, 0) - totalPagu)}</td>
            </tr></tfoot>
          </table>
        </div>
        {rows.length > 0 && !tabelBelumAda && (
          <div className="sticky bottom-3 mt-4"><button type="submit" className="btn-primary !px-6 !py-2.5">Simpan Anggaran Kas</button>
            <span className="ml-3 text-xs text-slate-500">Menyimpan seluruh baris di halaman ini.</span></div>
        )}
      </form>
      <p className="text-xs text-slate-500">Pagu bersumber dari <Link className="underline" href="/rekening">Input Anggaran</Link>. Kolom Selisih = total TW − pagu; bila pagu diubah setelah kas diisi, selisih akan muncul di sini.</p>
    </div>
  );
}
