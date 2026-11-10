import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { tahapanLabel } from "@/lib/periode";
import { ambilSemua } from "@/lib/anggaran/muat";
import { muatRincian, periksaData } from "@/lib/anggaran/periksa";
import { formatRupiah } from "@/lib/terbilang";
import TombolHapus from "@/components/TombolHapus";
import { updateRekening, deleteRekening } from "../../actions";

const input = "w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white";

/** UBAH BELANJA -- bagian atas: pagu (paling sering). Bagian bawah (tertutup): koreksi kode/uraian/sumber dana. */
export default async function UbahBelanjaPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: dpa } = await supabase
    .from("dpa").select("id, tahun_anggaran, tahapan, pagu_anggaran, pptk_id, rekening_id").eq("id", id).maybeSingle();
  if (!dpa) notFound();
  const tahun = dpa.tahun_anggaran as number;

  const [rincian, katalogRows, pptk, subs, log] = await Promise.all([
    muatRincian(supabase, tahun),
    ambilSemua<any>((a, b) => supabase.from("ref_belanja").select("kode_belanja, nama_belanja").order("kode_belanja").range(a, b)).catch(() => []),
    supabase.from("pejabat_skpd").select("id, nama").eq("jabatan", "PPTK").eq("tahun_anggaran", tahun).order("nama"),
    supabase.from("sub_kegiatan").select("id, kode_sub_kegiatan, nama_sub_kegiatan").eq("tahun_anggaran", tahun).order("kode_sub_kegiatan"),
    supabase.from("anggaran_log").select("created_at, username, tabel, aksi, tahapan, pagu_lama, pagu_baru, kolom_berubah, sebelum, sesudah")
      .eq("rekening_id", dpa.rekening_id).order("created_at", { ascending: false }).limit(6),
  ]);
  const r = rincian.find((x) => x.rekening_id === dpa.rekening_id);
  if (!r) notFound();
  const katalog = new Map<string, string>(katalogRows.map((k: any) => [String(k.kode_belanja), String(k.nama_belanja)]));
  const temuan = periksaData(rincian, katalog).filter((m) => m.rekening.rekening_id === r.rekening_id && m.tingkat !== "info");
  const kembali = `/rekening/${id}/ubah`;
  const ringkas = `${r.kode_rekening}\n${r.uraian} (${r.sumber_dana})\nPagu Rp ${formatRupiah(Number(dpa.pagu_anggaran))}`;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <Link href="/rekening" className="text-xs text-slate-500 hover:text-brand-700 inline-flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Kembali ke daftar</Link>
        <h1 className="page-title mt-2">Ubah Belanja</h1>
        <p className="page-sub"><span className="font-mono">{r.kode_rekening}</span><br />{r.uraian} · {r.sumber_dana} · <b>{tahapanLabel(dpa.tahapan)} {tahun}</b></p>
      </div>

      {temuan.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-1">
          <p className="font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Belanja ini ditandai kemungkinan salah:</p>
          {temuan.map((m, i) => <p key={i}>• {m.pesan}</p>)}
          <p className="text-xs">Perbaiki di bagian <b>“Koreksi kode, uraian, atau sumber dana”</b> di bawah.</p>
        </div>
      )}

      <form action={updateRekening} className="card p-5 space-y-6">
        <input type="hidden" name="dpa_id" value={dpa.id} />
        <input type="hidden" name="rekening_id" value={r.rekening_id} />
        <input type="hidden" name="pagu_lama" value={dpa.pagu_anggaran} />
        <input type="hidden" name="kembali" value={kembali} />

        <section className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><p className="text-sm font-semibold text-slate-900">Pagu {tahapanLabel(dpa.tahapan)} {tahun}</p><p className="text-xs text-slate-500">Hanya mengubah tahapan ini; tahapan lain tidak terpengaruh.</p></div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Pagu (Rp)</label>
            <input type="number" name="pagu_anggaran" required min={0} step="0.01" defaultValue={Number(dpa.pagu_anggaran)} className={`${input} text-base font-medium`} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">PPTK</label>
            <select name="pptk_id" defaultValue={dpa.pptk_id ?? ""} className={input}>
              <option value="">— tanpa PPTK —</option>
              {(pptk.data ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.nama}</option>)}
            </select>
          </div>
        </section>

        <details open={temuan.length > 0} className="rounded-xl border border-slate-200 p-4">
          <summary className="text-sm font-medium text-slate-900 cursor-pointer">Koreksi kode, uraian, atau sumber dana</summary>
          <p className="text-xs text-rose-700 mt-2">Perhatian: perubahan di bagian ini berlaku untuk <b>semua tahapan</b> (Murni, Pergeseran, Perubahan) dan tercatat di Riwayat.</p>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Sub kegiatan</label>
              <select name="sub_kegiatan_id" defaultValue={r.sub.id} className={input}>
                {(subs.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.kode_sub_kegiatan} — {s.nama_sub_kegiatan}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Kode rekening lengkap</label>
              <input name="kode_rekening" defaultValue={r.kode_rekening} className={`${input} font-mono`} />
              <label className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 cursor-pointer"><input type="checkbox" name="di_luar_katalog" value="1" className="accent-[#237469]" /> Kode ini memang tidak ada di katalog resmi</label>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Uraian belanja</label>
              <input name="jenis_belanja" defaultValue={r.uraian} className={input} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Kelompok</label>
              <select name="kelompok_belanja" defaultValue={r.kelompok ?? "Belanja Barang/Jasa"} className={input}>
                {Array.from(new Set([r.kelompok ?? "Belanja Barang/Jasa", "Belanja Barang/Jasa", "Belanja Modal"])).map((k) => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Sumber dana</label>
              <input name="sumber_dana" defaultValue={r.sumber_dana} className={input} />
            </div>
          </div>
        </details>

        <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
          <button type="submit" className="btn-primary">Simpan Perubahan</button>
          <Link href="/rekening" className="text-sm text-slate-500 hover:underline">Batal</Link>
        </div>
      </form>

      <div className="card p-4 flex items-center justify-between gap-3 text-sm">
        <p className="text-slate-600">Belanja ini salah total atau tidak jadi dianggarkan di {tahapanLabel(dpa.tahapan)}?</p>
        <TombolHapus action={deleteRekening} dpaId={dpa.id} rekeningId={r.rekening_id} ringkas={ringkas} kembali={kembali} label="Hapus belanja ini" />
      </div>

      <section className="card p-5">
        <p className="text-sm font-semibold text-slate-900 mb-2">Riwayat belanja ini</p>
        {(log.data ?? []).length === 0 ? <p className="text-xs text-slate-500">Belum ada catatan (perubahan sebelum fitur riwayat aktif tidak tercatat).</p> : (
          <ul className="text-xs text-slate-600 space-y-1.5">
            {(log.data ?? []).map((l: any, i: number) => (
              <li key={i}>
                <span className="text-slate-400">{new Date(l.created_at).toLocaleString("id-ID")}</span> · {l.username || "-"} ·{" "}
                {l.tabel === "rekening_belanja"
                  ? l.aksi === "ubah" ? (l.kolom_berubah ?? []).map((k: string) => `${k}: ${l.sebelum?.[k] ?? "—"} → ${l.sesudah?.[k] ?? "—"}`).join("; ") : `rekening ${l.aksi}`
                  : `pagu ${tahapanLabel(l.tahapan)} ${l.aksi}: ${formatRupiah(Number(l.pagu_lama ?? 0))} → ${formatRupiah(Number(l.pagu_baru ?? 0))}`}
              </li>
            ))}
          </ul>
        )}
        <Link href={`/rekening/riwayat?q=${encodeURIComponent(r.kode_belanja)}`} className="text-xs text-brand-700 hover:underline mt-2 inline-block">Lihat riwayat lengkap →</Link>
      </section>
    </div>
  );
}
