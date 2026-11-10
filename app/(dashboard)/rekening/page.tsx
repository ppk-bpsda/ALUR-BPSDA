import Link from "next/link";
import { Plus, FileSpreadsheet, Pencil, Copy, CheckCircle2, AlertTriangle, ShieldCheck, History, GitCompare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPeriode, tahapanLabel, TAHAPAN_OPTIONS } from "@/lib/periode";
import { formatRupiah } from "@/lib/terbilang";
import { ambilSemua } from "@/lib/anggaran/muat";
import { muatRincian, periksaData, statusAntarTahapan } from "@/lib/anggaran/periksa";
import type { TahapanKey } from "@/lib/anggaran/pagu";
import TombolHapus from "@/components/TombolHapus";
import { deleteRekening, salinDariTahapan } from "./actions";

const PER_HALAMAN = 100;

/**
 * INPUT ANGGARAN (DPA) -- satu daftar sederhana.
 *  Tambah  : tombol "+ Tambah Belanja"
 *  Ubah    : tombol "Ubah" di barisnya (pagu, atau koreksi kode/uraian/sumber dana)
 *  Hapus   : tombol "Hapus" di barisnya (ada konfirmasi)
 * Baris yang kemungkinan salah ditandai langsung di sini (tidak perlu membuka menu lain).
 */
export default async function InputAnggaranPage(props: {
  searchParams: Promise<{ ok?: string; q?: string; filter?: string; halaman?: string }>;
}) {
  const sp = await props.searchParams;
  const { tahun, tahapan } = await getPeriode();
  const supabase = await createClient();
  const tKey = tahapan as TahapanKey;

  const [dpaList, rincian, katalogRows] = await Promise.all([
    ambilSemua<any>((a, b) =>
      supabase.from("dpa").select("id, rekening_id, pagu_anggaran").eq("tahun_anggaran", tahun).eq("tahapan", tahapan).order("id").range(a, b)),
    muatRincian(supabase, tahun),
    ambilSemua<any>((a, b) => supabase.from("ref_belanja").select("kode_belanja, nama_belanja").order("kode_belanja").range(a, b)).catch(() => []),
  ]);
  const katalog = new Map<string, string>(katalogRows.map((k: any) => [String(k.kode_belanja), String(k.nama_belanja)]));
  const rek = new Map(rincian.map((r) => [r.rekening_id, r]));

  // temuan per rekening (hanya yang penting: "pasti salah" & "perlu diperiksa")
  const masalah = new Map<string, string[]>();
  for (const m of periksaData(rincian, katalog)) {
    if (m.tingkat === "info") continue;
    masalah.set(m.rekening.rekening_id, [...(masalah.get(m.rekening.rekening_id) ?? []), m.pesan]);
  }

  const baris = dpaList
    .map((d: any) => ({ dpa: d, r: rek.get(d.rekening_id)! }))
    .filter((x) => x.r)
    .sort((a, b) => a.r.sub.kode.localeCompare(b.r.sub.kode) || a.r.kode_rekening.localeCompare(b.r.kode_rekening) || a.r.sumber_dana.localeCompare(b.r.sumber_dana));

  const adaMasalah = (x: (typeof baris)[number]) => (masalah.get(x.r.rekening_id) ?? []).length > 0;
  const barukah = (x: (typeof baris)[number]) => statusAntarTahapan(x.r.pagu).baruDi === tKey;
  const jmlMasalah = baris.filter(adaMasalah).length;
  const jmlBaru = baris.filter(barukah).length;

  const q = String(sp.q ?? "").trim().toLowerCase().slice(0, 80);
  const filter = sp.filter === "masalah" || sp.filter === "baru" ? sp.filter : "";
  const terfilter = baris.filter((x) => {
    if (filter === "masalah" && !adaMasalah(x)) return false;
    if (filter === "baru" && !barukah(x)) return false;
    return !q || `${x.r.kode_rekening} ${x.r.uraian} ${x.r.sumber_dana} ${x.r.sub.nama}`.toLowerCase().includes(q);
  });
  const total = baris.reduce((s, x) => s + Number(x.dpa.pagu_anggaran), 0);

  const totalHalaman = Math.max(1, Math.ceil(terfilter.length / PER_HALAMAN));
  const halaman = Math.min(totalHalaman, Math.max(1, Number(sp.halaman) || 1));
  const tampil = terfilter.slice((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN);
  const href = (o: { filter?: string; halaman?: number }) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    const f = o.filter !== undefined ? o.filter : filter;
    if (f) p.set("filter", f);
    if (o.halaman && o.halaman > 1) p.set("halaman", String(o.halaman));
    const t = p.toString();
    return `/rekening${t ? `?${t}` : ""}`;
  };
  const tahapanLain = TAHAPAN_OPTIONS.filter((t) => t.value !== tahapan);
  const chip = (aktif: boolean) => `rounded-full px-3 py-1 text-xs ring-1 ring-inset ${aktif ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`;

  let subSebelumnya = "";
  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Input Anggaran (DPA)</h1>
        <p className="page-sub">
          Anda sedang mengisi pagu <b>{tahapanLabel(tahapan)} {tahun}</b>. Untuk pindah tahapan atau tahun, ganti di menu <Link href="/periode" className="underline">Periode</Link>.
        </p>
      </div>

      {sp.ok && <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" /> {sp.ok}</p>}

      <div className="card p-4 flex flex-wrap items-center gap-3">
        <Link href="/rekening/tambah" className="btn-primary"><Plus className="h-4 w-4" /> Tambah Belanja</Link>
        <Link href="/rekening/import" className="btn-secondary"><FileSpreadsheet className="h-4 w-4" /> Unggah dari Excel</Link>
        {tahapanLain.length > 0 && (
          <details className="relative">
            <summary className="btn-secondary cursor-pointer list-none"><Copy className="h-4 w-4" /> Salin dari tahapan lain</summary>
            <form action={salinDariTahapan} className="absolute z-20 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg p-4 space-y-3">
              <p className="text-xs text-slate-600">Mengisi {tahapanLabel(tahapan)} dengan pagu dari tahapan lain. Belanja yang sudah ada <b>tidak ditimpa</b>.</p>
              <select name="dari_tahapan" defaultValue={tahapanLain[0]?.value} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">
                {tahapanLain.map((t) => <option key={t.value} value={t.value}>Dari {t.label}</option>)}
              </select>
              <button type="submit" className="btn-primary w-full justify-center">Salin sekarang</button>
            </form>
          </details>
        )}
        <p className="text-xs text-slate-500 ml-auto max-w-sm">
          <b>Mengubah / menghapus:</b> tekan tombol <i>Ubah</i> atau <i>Hapus</i> di baris yang bersangkutan.
        </p>
      </div>

      {jmlMasalah > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-wrap items-center gap-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1"><b>{jmlMasalah} belanja</b> kemungkinan salah input (ditandai ⚠ di bawah). Tekan <i>Ubah</i> pada barisnya untuk memperbaiki.</span>
          <Link href={href({ filter: "masalah" })} className="underline font-medium">Tampilkan hanya yang ditandai</Link>
        </div>
      )}

      <form method="get" className="flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Cari kode, uraian, atau sumber dana…" className="flex-1 min-w-[220px] text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white" />
        {filter && <input type="hidden" name="filter" value={filter} />}
        <button className="btn-secondary" type="submit">Cari</button>
        <span className="mx-1 text-slate-300">|</span>
        <Link href={href({ filter: "" })} className={chip(!filter)}>Semua ({baris.length})</Link>
        <Link href={href({ filter: "masalah" })} className={chip(filter === "masalah")}>Ditandai ⚠ ({jmlMasalah})</Link>
        <Link href={href({ filter: "baru" })} className={chip(filter === "baru")}>Belanja baru ({jmlBaru})</Link>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="px-3 py-2.5 font-medium">Kode Rekening</th>
              <th className="px-3 py-2.5 font-medium">Uraian Belanja</th>
              <th className="px-3 py-2.5 font-medium">Sumber Dana</th>
              <th className="px-3 py-2.5 font-medium text-right">Pagu {tahapanLabel(tahapan)} (Rp)</th>
              <th className="px-3 py-2.5 font-medium w-40">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {terfilter.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">
                {baris.length === 0 ? <>Belum ada belanja pada {tahapanLabel(tahapan)} {tahun}. Tekan <b>+ Tambah Belanja</b>, <b>Unggah dari Excel</b>, atau salin dari tahapan lain.</> : "Tidak ada belanja yang cocok."}
              </td></tr>
            )}
            {tampil.map((x) => {
              const subBaru = x.r.sub.kode !== subSebelumnya;
              subSebelumnya = x.r.sub.kode;
              const temuan = masalah.get(x.r.rekening_id) ?? [];
              const ringkas = `${x.r.kode_rekening}\n${x.r.uraian} (${x.r.sumber_dana})\nPagu Rp ${formatRupiah(Number(x.dpa.pagu_anggaran))}`;
              return [
                subBaru && (
                  <tr key={`h-${x.r.sub.id}`} className="bg-slate-50">
                    <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-slate-700">
                      <span className="font-mono text-slate-500">{x.r.sub.kode}</span> · {x.r.sub.nama}
                    </td>
                  </tr>
                ),
                <tr key={x.dpa.id} className="border-b border-slate-50 align-top">
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-600 break-all">{x.r.kode_rekening}</td>
                  <td className="px-3 py-2.5">
                    <p className="text-slate-900">{x.r.uraian}{barukah(x) && <span className="ml-2 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px]" title="Belum ada di tahapan sebelumnya">baru</span>}</p>
                    {temuan.map((t, i) => <p key={i} className="text-xs text-amber-700 mt-0.5">⚠ {t}</p>)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{x.r.sumber_dana}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatRupiah(Number(x.dpa.pagu_anggaran))}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-4 text-sm">
                      <Link href={`/rekening/${x.dpa.id}/ubah`} className="inline-flex items-center gap-1 text-brand-700 hover:underline font-medium"><Pencil className="h-3.5 w-3.5" /> Ubah</Link>
                      <TombolHapus action={deleteRekening} dpaId={x.dpa.id} rekeningId={x.r.rekening_id} ringkas={ringkas} />
                    </div>
                  </td>
                </tr>,
              ];
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold">
              <td className="px-3 py-3" colSpan={3}>TOTAL PAGU {tahapanLabel(tahapan).toUpperCase()} {tahun} ({baris.length} belanja)</td>
              <td className="px-3 py-3 text-right tabular-nums">{formatRupiah(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {totalHalaman > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Halaman {halaman} dari {totalHalaman}</span>
          <span className="flex gap-4">
            {halaman > 1 && <Link href={href({ halaman: halaman - 1 })} className="hover:underline">← Sebelumnya</Link>}
            {halaman < totalHalaman && <Link href={href({ halaman: halaman + 1 })} className="hover:underline">Berikutnya →</Link>}
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
        <Link href="/rekap-pagu" className="inline-flex items-center gap-1 hover:text-brand-700"><GitCompare className="h-3.5 w-3.5" /> Bandingkan antartahapan</Link>
        <Link href="/rekening/pemeriksaan" className="inline-flex items-center gap-1 hover:text-brand-700"><ShieldCheck className="h-3.5 w-3.5" /> Pemeriksaan data lengkap</Link>
        <Link href="/rekening/riwayat" className="inline-flex items-center gap-1 hover:text-brand-700"><History className="h-3.5 w-3.5" /> Riwayat perubahan (siapa & kapan)</Link>
      </div>
    </div>
  );
}
