import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPeriode, tahapanLabel } from "@/lib/periode";
import { ambilSemua } from "@/lib/anggaran/muat";
import { addRekening, addKegiatan, addSubKegiatan } from "../actions";
import TambahRekeningFields from "../TambahRekeningFields";

const input = "w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white";

/** TAMBAH BELANJA -- form bertahap: 1 pilih sub kegiatan & kode belanja, 2 sumber dana, 3 pagu. */
export default async function TambahBelanjaPage(props: { searchParams: Promise<{ error?: string }> }) {
  const sp = await props.searchParams;
  const { tahun, tahapan } = await getPeriode();
  const supabase = await createClient();
  const [subs, pptk, program, kegiatan, katalog, sumberRef, terpakai] = await Promise.all([
    supabase.from("sub_kegiatan").select("id, kode_sub_kegiatan, nama_sub_kegiatan").eq("tahun_anggaran", tahun).order("kode_sub_kegiatan"),
    supabase.from("pejabat_skpd").select("id, nama").eq("jabatan", "PPTK").eq("tahun_anggaran", tahun).order("nama"),
    supabase.from("program").select("id, kode_program, nama_program").eq("tahun_anggaran", tahun).order("kode_program"),
    supabase.from("kegiatan").select("id, kode_kegiatan, nama_kegiatan").eq("tahun_anggaran", tahun).order("kode_kegiatan"),
    ambilSemua<any>((a, b) => supabase.from("ref_belanja").select("kode_belanja, nama_belanja").order("kode_belanja").range(a, b)).catch(() => []),
    supabase.from("ref_sumber_dana").select("nama").order("nama"),
    ambilSemua<any>((a, b) => supabase.from("rekening_belanja").select("sumber_dana, sub_kegiatan!inner(tahun_anggaran)").eq("sub_kegiatan.tahun_anggaran", tahun).order("id").range(a, b)).catch(() => []),
  ]);
  const sumberDana = Array.from(new Map([...(sumberRef.data ?? []).map((r: any) => String(r.nama ?? "").trim()), ...terpakai.map((r: any) => String(r.sumber_dana ?? "").trim())]
    .filter(Boolean).map((v) => [v.toLowerCase(), v] as const)).values()).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <Link href="/rekening" className="text-xs text-slate-500 hover:text-brand-700 inline-flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Kembali ke daftar</Link>
        <h1 className="page-title mt-2">Tambah Belanja</h1>
        <p className="page-sub">Pagu ini akan masuk ke <b>{tahapanLabel(tahapan)} {tahun}</b>.</p>
      </div>

      <form action={addRekening} className="card p-5 space-y-5">
        <input type="hidden" name="kembali" value="/rekening/tambah" />
        <section>
          <p className="text-sm font-semibold text-slate-900 mb-1">Langkah 1 — Pilih sub kegiatan dan kode belanja</p>
          <p className="text-xs text-slate-500 mb-3">Cari kode belanja di kotak katalog: kode lengkap dan uraian terisi otomatis. Kode yang salah ketik akan ditolak sistem.</p>
          <div className="grid sm:grid-cols-6 gap-3 items-end">
            <TambahRekeningFields subKegiatan={(subs.data ?? []) as any} katalog={(katalog ?? []) as any} />
          </div>
        </section>

        <section className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3"><p className="text-sm font-semibold text-slate-900">Langkah 2 — Sumber dana, PPTK, dan pagu</p></div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Sumber Dana</label>
            <input name="sumber_dana" list="daftar-sumber-dana" required autoComplete="off" placeholder="mis. PAD" className={input} />
            <datalist id="daftar-sumber-dana">{sumberDana.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">PPTK</label>
            <select name="pptk_id" defaultValue="" className={input}>
              <option value="">— pilih PPTK —</option>
              {(pptk.data ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.nama}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Pagu {tahapanLabel(tahapan)} (Rp)</label>
            <input type="number" name="pagu_anggaran" required min={0} step="0.01" placeholder="0" className={input} />
          </div>
        </section>

        <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
          <button type="submit" className="btn-primary">Simpan Belanja</button>
          <Link href="/rekening" className="text-sm text-slate-500 hover:underline">Batal</Link>
        </div>
      </form>

      <details className="card p-5">
        <summary className="text-sm font-medium text-slate-900 cursor-pointer">Sub kegiatan yang dibutuhkan belum ada di daftar?</summary>
        <div className="mt-4 space-y-6">
          <form action={addSubKegiatan} className="grid sm:grid-cols-4 gap-3 items-end">
            <input type="hidden" name="kembali" value="/rekening/tambah" />
            <div className="sm:col-span-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tambah sub kegiatan baru</div>
            <div className="sm:col-span-2"><label className="text-xs text-slate-600 mb-1 block">Kegiatan induk</label>
              <select name="kegiatan_id" required defaultValue="" className={input}><option value="" disabled>Pilih kegiatan</option>
                {(kegiatan.data ?? []).map((k: any) => <option key={k.id} value={k.id}>{k.kode_kegiatan} — {k.nama_kegiatan}</option>)}</select></div>
            <div><label className="text-xs text-slate-600 mb-1 block">Kode sub kegiatan</label><input name="kode_sub_kegiatan" required placeholder="4.01.01.2.01.0001" className={`${input} font-mono`} /></div>
            <div><label className="text-xs text-slate-600 mb-1 block">Nama</label><input name="nama_sub_kegiatan" required className={input} /></div>
            <button type="submit" className="btn-secondary sm:col-span-4 w-fit">+ Tambah sub kegiatan</button>
          </form>
          <form action={addKegiatan} className="grid sm:grid-cols-4 gap-3 items-end pt-4 border-t border-slate-100">
            <input type="hidden" name="kembali" value="/rekening/tambah" />
            <div className="sm:col-span-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kegiatan induknya juga belum ada? Tambah dulu</div>
            <div className="sm:col-span-2"><label className="text-xs text-slate-600 mb-1 block">Program induk</label>
              <select name="program_id" required defaultValue="" className={input}><option value="" disabled>Pilih program</option>
                {(program.data ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.kode_program} — {p.nama_program}</option>)}</select></div>
            <div><label className="text-xs text-slate-600 mb-1 block">Kode kegiatan</label><input name="kode_kegiatan" required placeholder="4.01.01.2.01" className={`${input} font-mono`} /></div>
            <div><label className="text-xs text-slate-600 mb-1 block">Nama</label><input name="nama_kegiatan" required className={input} /></div>
            <button type="submit" className="btn-secondary sm:col-span-4 w-fit">+ Tambah kegiatan</button>
          </form>
        </div>
      </details>
    </div>
  );
}
