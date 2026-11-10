import Link from "next/link";
import { ArrowLeft, History, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPeriode, tahapanLabel } from "@/lib/periode";
import { formatRupiah } from "@/lib/terbilang";
import { TAHAPAN_KUNCI } from "@/lib/anggaran/pagu";
import { muatRincian, muatAsalPagu, statusAntarTahapan, periksaData } from "@/lib/anggaran/periksa";
import { ambilSemua } from "@/lib/anggaran/muat";

type Filter = "baru" | "hilang" | "semua";

/**
 * Rincian per rekening di balik angka "N belanja baru" pada Perbandingan Pagu Tahapan.
 * Menunjukkan REKENING MANA yang baru / tidak dibawa, siapa dan kapan membuatnya (bila tercatat),
 * serta tautan untuk memperbaikinya.
 */
export default async function RincianPaguPage(props: { searchParams: Promise<{ sub?: string; status?: string; q?: string }> }) {
  const sp = await props.searchParams;
  const { tahun } = await getPeriode();
  const supabase = await createClient();
  const status: Filter = sp.status === "hilang" || sp.status === "semua" ? sp.status : "baru";
  const q = String(sp.q ?? "").trim().toLowerCase().slice(0, 80);

  const [rincian, asal, katalogRows] = await Promise.all([
    muatRincian(supabase, tahun),
    muatAsalPagu(supabase, tahun),
    ambilSemua<any>((a, b) => supabase.from("ref_belanja").select("kode_belanja, nama_belanja").order("kode_belanja").range(a, b)).catch(() => []),
  ]);
  const katalog = new Map<string, string>(katalogRows.map((k: any) => [String(k.kode_belanja), String(k.nama_belanja)]));
  const temuan = new Map<string, string[]>();
  for (const m of periksaData(rincian, katalog)) {
    if (m.tingkat === "info") continue;
    temuan.set(m.rekening.rekening_id, [...(temuan.get(m.rekening.rekening_id) ?? []), m.pesan]);
  }

  const subNama = rincian.find((r) => r.sub.id === sp.sub)?.sub;
  const baris = rincian
    .map((r) => ({ r, st: statusAntarTahapan(r.pagu) }))
    .filter(({ r, st }) => {
      if (sp.sub && r.sub.id !== sp.sub) return false;
      if (status === "baru" && !st.baruDi) return false;
      if (status === "hilang" && !st.hilangDi) return false;
      if (q && !`${r.kode_rekening} ${r.uraian} ${r.sumber_dana}`.toLowerCase().includes(q)) return false;
      return true;
    });

  const link = (s: Filter) => `/rekap-pagu/rincian?status=${s}${sp.sub ? `&sub=${sp.sub}` : ""}`;
  const tab = (s: Filter, label: string) => (
    <Link href={link(s)} className={`rounded-full px-3 py-1 text-xs ring-1 ring-inset ${status === s ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}>{label}</Link>
  );
  const sel = (n?: number) => (n === undefined ? <span className="text-slate-300">—</span> : formatRupiah(n));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/rekap-pagu" className="text-xs text-slate-500 hover:text-brand-700 inline-flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Perbandingan Pagu Tahapan</Link>
        <h1 className="page-title mt-2">Rincian Belanja Baru &amp; Tidak Dibawa</h1>
        <p className="page-sub">
          Tahun Anggaran {tahun}{subNama ? <> · Sub kegiatan <b>{subNama.kode}</b> {subNama.nama}</> : " · semua sub kegiatan"}.
          <b> Baru</b> = rekening muncul di suatu tahapan padahal tidak ada di tahapan sebelumnya. <b>Tidak dibawa</b> = ada di tahapan sebelumnya tetapi tidak ada di tahapan berikutnya.
          Bila yang baru sebenarnya salah kode dari belanja lama, perbaiki kodenya lewat <b>Rekening &amp; Pagu</b> (Ubah kode) agar tidak terbaca sebagai belanja baru.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tab("baru", "Belanja baru")}{tab("hilang", "Tidak dibawa")}{tab("semua", "Semua rekening")}
        {sp.sub && <Link href={link(status).replace(/&sub=[^&]*/, "")} className="text-xs text-slate-500 hover:underline ml-2">Tampilkan semua sub kegiatan</Link>}
        <span className="text-xs text-slate-500 ml-auto">{baris.length} rekening</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-xs min-w-[1000px]">
          <thead><tr className="text-left text-slate-400 border-b border-slate-100">
            <th className="px-3 py-2 font-medium">Rekening</th>
            {TAHAPAN_KUNCI.map((t) => <th key={t} className="px-3 py-2 font-medium text-right">{tahapanLabel(t)}</th>)}
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Dibuat / diubah oleh</th>
            <th className="px-3 py-2 font-medium">Telusuri</th>
          </tr></thead>
          <tbody>
            {baris.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Tidak ada rekening pada filter ini.</td></tr>}
            {baris.map(({ r, st }) => {
              const a = st.baruDi ? asal.get(`${r.rekening_id}|${st.baruDi}`) : undefined;
              const catatan = temuan.get(r.rekening_id) ?? [];
              return (
                <tr key={r.rekening_id} className="border-b border-slate-50 align-top">
                  <td className="px-3 py-2">
                    <p className="text-[10px] text-slate-400">{r.sub.kode} · {r.sub.nama}</p>
                    <p className="font-mono text-slate-700 break-all">{r.kode_rekening}</p>
                    <p className="text-slate-800">{r.uraian}</p>
                    <p className="text-slate-400">{r.sumber_dana}</p>
                    {catatan.map((c, i) => <p key={i} className="text-amber-700 mt-0.5">⚠ {c}</p>)}
                  </td>
                  {TAHAPAN_KUNCI.map((t) => <td key={t} className="px-3 py-2 text-right">{sel(r.pagu[t])}</td>)}
                  <td className="px-3 py-2 space-y-1">
                    {st.baruDi && <span className="block rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 w-fit">Baru di {tahapanLabel(st.baruDi)}</span>}
                    {st.hilangDi && <span className="block rounded-full bg-rose-50 text-rose-700 px-2 py-0.5 w-fit">Tidak ada di {tahapanLabel(st.hilangDi)}</span>}
                    {!st.baruDi && !st.hilangDi && <span className="text-slate-400">Konsisten</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {a ? (<>
                      <p>{a.username || "-"}</p>
                      <p className="text-slate-400">{new Date(a.waktu).toLocaleString("id-ID")}</p>
                      <p className="text-slate-400">{a.sumber === "excel" ? `Excel: ${a.berkas ?? "-"}${a.baris ? ` · baris ${a.baris}` : ""}` : a.sumber === "salin" ? "Disalin antartahapan" : "Input manual"}</p>
                    </>) : st.baruDi ? <span className="text-slate-400">Tidak tercatat (dibuat sebelum riwayat aktif)</span> : "—"}
                  </td>
                  <td className="px-3 py-2 space-y-1">
                    <Link href={`/rekening?q=${encodeURIComponent(r.kode_belanja)}&sub=${r.sub.id}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><Pencil className="h-3 w-3" /> Perbaiki</Link>
                    <Link href={`/rekening/riwayat?q=${encodeURIComponent(r.kode_belanja)}`} className="flex items-center gap-1 text-brand-700 hover:underline"><History className="h-3 w-3" /> Riwayat</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Untuk memperbaiki: buka periode tahapan tempat rekening itu berada (menu periode), lalu ubah di <b>Rekening &amp; Pagu</b>. Perubahan kode/uraian berlaku untuk semua tahapan dan tercatat di Riwayat.
        Pemeriksaan otomatis lain ada di <Link href="/rekening/pemeriksaan" className="underline">Pemeriksaan Data Pagu</Link>.
      </p>
    </div>
  );
}
