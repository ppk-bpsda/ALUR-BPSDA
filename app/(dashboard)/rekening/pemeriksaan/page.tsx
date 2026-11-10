import Link from "next/link";
import { ArrowLeft, History, Pencil, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPeriode, tahapanLabel } from "@/lib/periode";
import { ambilSemua } from "@/lib/anggaran/muat";
import { tautanUbah, muatRincian, periksaData, type Masalah } from "@/lib/anggaran/periksa";

const WARNA = { galat: "bg-rose-50 text-rose-700", periksa: "bg-amber-50 text-amber-700", info: "bg-sky-50 text-sky-700" } as const;
const LABEL = { galat: "Pasti salah", periksa: "Perlu diperiksa", info: "Informasi" } as const;

/**
 * Pemeriksaan otomatis seluruh rekening & pagu Tahun Anggaran aktif: menemukan kode salah ketik,
 * uraian tidak cocok katalog, rekening dobel, belanja baru/tidak dibawa antartahapan, dsb.
 * Tiap temuan menyebut rekening dan tautan perbaikannya.
 */
export default async function PemeriksaanPage(props: { searchParams: Promise<{ tingkat?: string; jenis?: string }> }) {
  const sp = await props.searchParams;
  const { tahun } = await getPeriode();
  const supabase = await createClient();
  const [rincian, katalogRows] = await Promise.all([
    muatRincian(supabase, tahun),
    ambilSemua<any>((a, b) => supabase.from("ref_belanja").select("kode_belanja, nama_belanja").order("kode_belanja").range(a, b)).catch(() => []),
  ]);
  const katalog = new Map<string, string>(katalogRows.map((k: any) => [String(k.kode_belanja), String(k.nama_belanja)]));
  const semua = periksaData(rincian, katalog);

  const tingkat = sp.tingkat === "galat" || sp.tingkat === "periksa" || sp.tingkat === "info" ? sp.tingkat : "";
  const ditampilkan = semua
    .filter((m) => (!tingkat || m.tingkat === tingkat) && (!sp.jenis || m.jenis === sp.jenis))
    .sort((a, b) => ["galat", "periksa", "info"].indexOf(a.tingkat) - ["galat", "periksa", "info"].indexOf(b.tingkat) || a.rekening.kode_rekening.localeCompare(b.rekening.kode_rekening));

  const hitung = (t: Masalah["tingkat"]) => semua.filter((m) => m.tingkat === t).length;
  const jenisUnik = Array.from(new Set(semua.map((m) => m.jenis))).sort();
  const href = (t: string, j = "") => `/rekening/pemeriksaan?${new URLSearchParams({ ...(t ? { tingkat: t } : {}), ...(j ? { jenis: j } : {}) }).toString()}`;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/rekening" className="text-xs text-slate-500 hover:text-brand-700 inline-flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Input Anggaran</Link>
        <h1 className="page-title mt-2 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-brand-700" /> Pemeriksaan Data Pagu</h1>
        <p className="page-sub">
          Tahun Anggaran {tahun}: {rincian.length} rekening diperiksa terhadap katalog resmi ({katalog.size || "katalog belum tersedia"}), struktur kode, penulisan sumber dana, dan perpindahan antartahapan.
          Temuan <b>&quot;Pasti salah&quot;</b> sebaiknya diperbaiki dulu; <b>&quot;Perlu diperiksa&quot;</b> bisa jadi benar — cocokkan dengan dokumen DPA.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link href={href("")} className={`rounded-full px-3 py-1 ring-1 ring-inset ${!tingkat ? "bg-brand-700 text-white ring-brand-700" : "bg-white ring-slate-200"}`}>Semua ({semua.length})</Link>
        {(["galat", "periksa", "info"] as const).map((t) => (
          <Link key={t} href={href(t)} className={`rounded-full px-3 py-1 ring-1 ring-inset ${tingkat === t ? "bg-brand-700 text-white ring-brand-700" : `${WARNA[t]} ring-transparent`}`}>{LABEL[t]} ({hitung(t)})</Link>
        ))}
        <span className="text-slate-400 mx-1">|</span>
        {jenisUnik.map((j) => <Link key={j} href={href(tingkat, j)} className={`rounded-full px-2.5 py-1 ring-1 ring-inset ${sp.jenis === j ? "bg-slate-800 text-white ring-slate-800" : "bg-white text-slate-600 ring-slate-200"}`}>{j}</Link>)}
      </div>

      {semua.length === 0 && <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-3">Tidak ditemukan masalah pada data pagu Tahun Anggaran {tahun}.</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-xs min-w-[900px]">
          <thead><tr className="text-left text-slate-400 border-b border-slate-100">
            <th className="px-3 py-2 font-medium">Tingkat</th><th className="px-3 py-2 font-medium">Rekening</th>
            <th className="px-3 py-2 font-medium">Temuan</th><th className="px-3 py-2 font-medium">Telusuri</th>
          </tr></thead>
          <tbody>
            {ditampilkan.slice(0, 400).map((m, i) => (
              <tr key={i} className="border-b border-slate-50 align-top">
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 ${WARNA[m.tingkat]}`}>{LABEL[m.tingkat]}</span></td>
                <td className="px-3 py-2">
                  <p className="text-[10px] text-slate-400">{m.rekening.sub.kode} · {m.rekening.sub.nama}</p>
                  <p className="font-mono text-slate-700 break-all">{m.rekening.kode_rekening}</p>
                  <p>{m.rekening.uraian} <span className="text-slate-400">· {m.rekening.sumber_dana}</span></p>
                  <p className="text-slate-400">{(["murni", "pergeseran", "perubahan"] as const).filter((t) => m.rekening.pagu[t] !== undefined).map(tahapanLabel).join(", ") || "tanpa pagu"}</p>
                </td>
                <td className="px-3 py-2"><p className="font-medium text-slate-800">{m.jenis}{m.tahapan ? ` (${tahapanLabel(m.tahapan)})` : ""}</p><p className="text-slate-600">{m.pesan}</p></td>
                <td className="px-3 py-2 space-y-1">
                  {tautanUbah(m.rekening) && <Link href={tautanUbah(m.rekening)!} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><Pencil className="h-3 w-3" /> Perbaiki</Link>}
                  <Link href={`/rekening/riwayat?q=${encodeURIComponent(m.rekening.kode_belanja)}`} className="flex items-center gap-1 text-brand-700 hover:underline"><History className="h-3 w-3" /> Riwayat</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ditampilkan.length > 400 && <p className="text-xs text-slate-500">Menampilkan 400 dari {ditampilkan.length} temuan; persempit dengan filter di atas.</p>}
      <p className="text-xs text-slate-500">Tombol <b>Perbaiki</b> membuka halaman Ubah pada belanja yang bersangkutan.</p>
    </div>
  );
}
