import type { SupabaseClient } from "@supabase/supabase-js";
import { TAHAPAN_URUT, type DataAcuan } from "./pagu";

// PostgREST membatasi respons 1000 baris per request -- ambil semua halaman.
export async function ambilSemua<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

/** Data acuan yang dibutuhkan susunRencana() untuk satu Tahun Anggaran + tahapan tujuan. */
export async function muatDataAcuan(supabase: SupabaseClient, tahun: number, tahapan: string): Promise<DataAcuan> {
  const [programs, kegiatan, subs, rekening, dpaSemua, pptk, pengajuan] = await Promise.all([
    ambilSemua<any>((a, b) => supabase.from("program").select("id, kode_program").eq("tahun_anggaran", tahun).order("id").range(a, b)),
    ambilSemua<any>((a, b) => supabase.from("kegiatan").select("id, kode_kegiatan, program_id").eq("tahun_anggaran", tahun).order("id").range(a, b)),
    ambilSemua<any>((a, b) => supabase.from("sub_kegiatan").select("id, kode_sub_kegiatan, kegiatan_id").eq("tahun_anggaran", tahun).order("id").range(a, b)),
    ambilSemua<any>((a, b) =>
      supabase.from("rekening_belanja").select("id, sub_kegiatan_id, kode_rekening, sumber_dana, sub_kegiatan!inner(tahun_anggaran)")
        .eq("sub_kegiatan.tahun_anggaran", tahun).order("id").range(a, b)
    ),
    ambilSemua<any>((a, b) => supabase.from("dpa").select("id, rekening_id, tahapan, pagu_anggaran, pptk_id").eq("tahun_anggaran", tahun).order("id").range(a, b)),
    ambilSemua<any>((a, b) =>
      supabase.from("pejabat_skpd").select("id, nama, sub_kegiatan_id").eq("jabatan", "PPTK").eq("tahun_anggaran", tahun).order("id").range(a, b)
    ),
    ambilSemua<any>((a, b) =>
      supabase.from("pengajuan_belanja").select("jumlah_pengajuan, dpa!inner(rekening_id, tahun_anggaran, tahapan)")
        .eq("dpa.tahun_anggaran", tahun).eq("status", "dicairkan").order("id").range(a, b)
    ),
  ]);

  const urutTujuan = TAHAPAN_URUT[tahapan] ?? 1;
  const dpaTujuan = new Map<string, { id: string; pagu_anggaran: number; pptk_id: string | null }>();
  const pptkWarisan = new Map<string, { urut: number; id: string }>();
  for (const d of dpaSemua) {
    if (d.tahapan === tahapan) dpaTujuan.set(d.rekening_id, { id: d.id, pagu_anggaran: Number(d.pagu_anggaran), pptk_id: d.pptk_id });
    else if (d.pptk_id) {
      const u = TAHAPAN_URUT[d.tahapan] ?? 0;
      const sebelumnya = pptkWarisan.get(d.rekening_id);
      // utamakan tahapan terdekat sebelum tujuan
      if (!sebelumnya || (u < urutTujuan && u > sebelumnya.urut)) pptkWarisan.set(d.rekening_id, { urut: u, id: d.pptk_id });
    }
  }

  // Realisasi terakumulasi s/d tahapan tujuan (aturan sama dengan view rekap_realisasi).
  const realisasi = new Map<string, number>();
  for (const p of pengajuan) {
    const d: any = p.dpa;
    if (!d || (TAHAPAN_URUT[d.tahapan] ?? 0) > urutTujuan) continue;
    realisasi.set(d.rekening_id, (realisasi.get(d.rekening_id) ?? 0) + Number(p.jumlah_pengajuan || 0));
  }

  return {
    programs, kegiatan, subs,
    rekening: rekening.map((r: any) => ({ id: r.id, sub_kegiatan_id: r.sub_kegiatan_id, kode_rekening: r.kode_rekening, sumber_dana: r.sumber_dana })),
    dpaTujuan,
    pptkWarisan: new Map(Array.from(pptkWarisan, ([k, v]) => [k, v.id])),
    pptk, realisasi,
  };
}
