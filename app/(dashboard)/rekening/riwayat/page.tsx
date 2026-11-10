import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPeriode, tahapanLabel, TAHAPAN_OPTIONS } from "@/lib/periode";

const PER_HALAMAN = 50;
const rp = (n: any) => (n === null || n === undefined ? "—" : new Intl.NumberFormat("id-ID").format(Number(n)));
const NAMA_KOLOM: Record<string, string> = {
  kode_rekening: "Kode rekening", jenis_belanja: "Uraian", sumber_dana: "Sumber dana", kelompok_belanja: "Kelompok",
  sub_kegiatan_id: "Sub kegiatan", pagu_anggaran: "Pagu", pptk_id: "PPTK", keterangan: "Keterangan", tahapan: "Tahapan", rekening_id: "Rekening",
};

/**
 * Riwayat Pagu -- jejak audit lengkap (siapa, kapan, nilai SEBELUM -> SESUDAH).
 * Mencari kode rekening juga menemukan perubahan yang dulu memakai kode LAMA (yang salah),
 * sehingga kesalahan input bisa dilacak sampai ke sumbernya (berkas/baris Excel atau edit manual).
 */
export default async function RiwayatPage(props: {
  searchParams: Promise<{ q?: string; tahapan?: string; jenis?: string; halaman?: string }>;
}) {
  const sp = await props.searchParams;
  const { tahun } = await getPeriode();
  const supabase = await createClient();
  const halaman = Math.max(1, Number(sp.halaman) || 1);
  // hanya karakter kode/teks sederhana -- aman dipakai dalam filter PostgREST
  const q = String(sp.q ?? "").replace(/[^0-9A-Za-z.\- ]/g, "").trim().slice(0, 60);
  const tahapan = TAHAPAN_OPTIONS.some((t) => t.value === sp.tahapan) ? sp.tahapan : "";
  const jenis = sp.jenis === "master" || sp.jenis === "pagu" ? sp.jenis : "";

  let query = supabase
    .from("anggaran_log")
    .select("id, created_at, username, tahapan, sumber, aksi, tabel, kode_rekening, sumber_dana, pagu_lama, pagu_baru, kolom_berubah, sebelum, sesudah, nama_berkas, nomor_baris, batch_id", { count: "exact" })
    .eq("tahun_anggaran", tahun)
    .order("created_at", { ascending: false })
    .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);
  if (q) query = query.or(`kode_rekening.ilike.%${q}%,sebelum->>kode_rekening.ilike.%${q}%,sesudah->>kode_rekening.ilike.%${q}%,nama_berkas.ilike.%${q}%`);
  if (tahapan) query = query.in("tahapan", [tahapan, "semua"]);
  if (jenis === "master") query = query.eq("tabel", "rekening_belanja");
  if (jenis === "pagu") query = query.or("tabel.eq.dpa,tabel.is.null");
  const { data: log, count, error } = await query;

  const totalHalaman = Math.max(1, Math.ceil((count ?? 0) / PER_HALAMAN));
  const href = (h: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (tahapan) p.set("tahapan", tahapan);
    if (jenis) p.set("jenis", jenis);
    if (h > 1) p.set("halaman", String(h));
    const s = p.toString();
    return `/rekening/riwayat${s ? `?${s}` : ""}`;
  };

  function Perubahan({ l }: { l: any }) {
    if (l.tabel === "rekening_belanja") {
      if (l.aksi === "ubah") {
        return (
          <div className="space-y-0.5">
            {(l.kolom_berubah ?? []).map((k: string) => (
              <p key={k}><span className="text-slate-400">{NAMA_KOLOM[k] ?? k}:</span>{" "}
                <span className="font-mono text-rose-700 line-through break-all">{String(l.sebelum?.[k] ?? "—")}</span>{" → "}
                <span className="font-mono text-emerald-700 break-all">{String(l.sesudah?.[k] ?? "—")}</span></p>
            ))}
          </div>
        );
      }
      const d = l.sesudah ?? l.sebelum ?? {};
      return <p className="text-slate-500">{l.aksi === "tambah" ? "Rekening dibuat" : "Rekening dihapus"}: {d.jenis_belanja}</p>;
    }
    return (
      <p>
        {l.aksi === "ubah" && (l.kolom_berubah ?? []).includes("pptk_id") && !(l.kolom_berubah ?? []).includes("pagu_anggaran") ? "PPTK diganti" : (
          <>Pagu <span className="text-rose-700">{rp(l.pagu_lama)}</span> → <span className="text-emerald-700 font-medium">{rp(l.pagu_baru)}</span></>
        )}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/rekening" className="text-xs text-slate-500 hover:text-brand-700 inline-flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Input Anggaran</Link>
        <h1 className="page-title mt-2">Riwayat Perubahan Pagu &amp; Rekening</h1>
        <p className="page-sub">
          Tahun Anggaran {tahun}. Setiap perubahan pagu, kode rekening, uraian, sumber dana, penghapusan, dan penyalinan tercatat otomatis
          (siapa, kapan, nilai sebelum → sesudah, dari berkas/baris Excel mana). Cari <b>kode yang salah maupun yang sudah dibetulkan</b> untuk menelusuri asal kesalahannya.
        </p>
      </div>

      <form className="card p-4 flex flex-wrap items-end gap-3" method="get">
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs font-medium text-slate-600 block mb-1">Kode rekening / nama berkas</label>
          <input name="q" defaultValue={q} placeholder="mis. 5.1.02.01.001.00024"
            className="w-full text-sm font-mono border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Tahapan</label>
          <select name="tahapan" defaultValue={tahapan} className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">
            <option value="">Semua</option>
            {TAHAPAN_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Jenis perubahan</label>
          <select name="jenis" defaultValue={jenis} className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">
            <option value="">Semua</option>
            <option value="master">Kode / uraian / sumber dana</option>
            <option value="pagu">Pagu / PPTK</option>
          </select>
        </div>
        <button className="btn-primary" type="submit"><Search className="h-4 w-4" /> Cari</button>
        {(q || tahapan || jenis) && <Link href="/rekening/riwayat" className="text-xs text-slate-500 hover:underline pb-2">Reset</Link>}
      </form>

      {error ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Riwayat belum dapat dibaca. Pastikan migrasi <code>20260810000000_audit_pagu_dan_simpan_atomik.sql</code> sudah dijalankan di Supabase.
        </p>
      ) : (
        <section className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead><tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="px-3 py-2 font-medium">Waktu</th><th className="px-3 py-2 font-medium">Oleh</th>
                <th className="px-3 py-2 font-medium">Tahapan</th><th className="px-3 py-2 font-medium">Aksi</th>
                <th className="px-3 py-2 font-medium">Kode rekening</th><th className="px-3 py-2 font-medium">Perubahan</th>
                <th className="px-3 py-2 font-medium">Asal</th>
              </tr></thead>
              <tbody>
                {(log ?? []).length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Tidak ada riwayat yang cocok.</td></tr>}
                {(log ?? []).map((l: any) => (
                  <tr key={l.id} className="border-b border-slate-50 align-top">
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{new Date(l.created_at).toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2">{l.username || "-"}</td>
                    <td className="px-3 py-2">{l.tahapan === "semua" ? <span className="text-violet-700" title="Master rekening: berlaku semua tahapan">semua</span> : tahapanLabel(l.tahapan)}</td>
                    <td className="px-3 py-2">{l.tabel === "rekening_belanja" ? "master" : "pagu"} · {l.aksi}</td>
                    <td className="px-3 py-2 font-mono text-slate-600 break-all">{l.kode_rekening || "-"}<span className="block text-slate-400 font-sans">{l.sumber_dana}</span></td>
                    <td className="px-3 py-2"><Perubahan l={l} /></td>
                    <td className="px-3 py-2 text-slate-500">{l.sumber}{l.nama_berkas ? <span className="block">{l.nama_berkas}{l.nomor_baris ? ` · baris ${l.nomor_baris}` : ""}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-500 border-t border-slate-100">
            <span>{count ?? 0} catatan · halaman {halaman} dari {totalHalaman}</span>
            <span className="flex gap-3">
              {halaman > 1 && <Link href={href(halaman - 1)} className="hover:underline">← Sebelumnya</Link>}
              {halaman < totalHalaman && <Link href={href(halaman + 1)} className="hover:underline">Berikutnya →</Link>}
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
