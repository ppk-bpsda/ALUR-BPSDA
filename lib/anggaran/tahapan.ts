import type { SupabaseClient } from "@supabase/supabase-js";
import { TAHAPAN_OPTIONS } from "@/lib/periode";
import { ambilSemua } from "./muat";

export type TanggalPerTahapan = Record<string, string | null>;

/** Validasi urutan kronologis tanggal penetapan. Mengembalikan pesan galat atau null. */
export function validasiUrutanTanggal({ murni, pergeseran, perubahan }: TanggalPerTahapan): string | null {
  if (murni && pergeseran && pergeseran <= murni) return "Tanggal penetapan Pergeseran harus setelah tanggal penetapan Murni.";
  if (pergeseran && perubahan && perubahan <= pergeseran) return "Tanggal penetapan Perubahan harus setelah tanggal penetapan Pergeseran.";
  if (murni && perubahan && !pergeseran && perubahan <= murni) return "Tanggal penetapan Perubahan harus setelah tanggal penetapan Murni.";
  return null;
}

/**
 * (1) Simpan tanggal penetapan ke SEMUA baris DPA tahapan terkait pada tahun itu,
 * (2) sortir ulang Pengajuan Belanja ke dpa_id (tahapan) yang berlaku menurut
 *     tanggal transaksinya -- logika sama dengan resolveDpaId() di PengajuanForm.tsx.
 * Hanya tahapan yang tanggalnya DIKIRIM (key ada di objek) yang diperbarui.
 * Mengembalikan jumlah pengajuan yang dipindah. Melempar Error bila gagal.
 */
export async function terapkanTanggalTahapan(
  supabase: SupabaseClient,
  tahun: number,
  tanggal: TanggalPerTahapan
): Promise<number> {
  for (const t of TAHAPAN_OPTIONS) {
    if (!(t.value in tanggal)) continue;
    const { error } = await supabase
      .from("dpa")
      .update({ tanggal_penetapan: tanggal[t.value] })
      .eq("tahun_anggaran", tahun)
      .eq("tahapan", t.value);
    if (error) throw new Error(`Gagal menyimpan tanggal ${t.label}: ${error.message}`);
  }

  const dpaRows = await ambilSemua<any>((a, b) =>
    supabase.from("dpa").select("id, rekening_id, tahapan, tanggal_penetapan").eq("tahun_anggaran", tahun).order("id").range(a, b)
  );
  const dpaByRekening = new Map<string, any[]>();
  for (const d of dpaRows) {
    const list = dpaByRekening.get(d.rekening_id) ?? [];
    list.push(d);
    dpaByRekening.set(d.rekening_id, list);
  }
  function resolveDpaId(rekeningId: string, tgl: string): string | null {
    const rows = dpaByRekening.get(rekeningId) ?? [];
    if (rows.length === 0) return null;
    const berlaku = rows
      .filter((d) => !d.tanggal_penetapan || d.tanggal_penetapan <= tgl)
      .sort((a, b) => String(b.tanggal_penetapan || "0000-00-00").localeCompare(String(a.tanggal_penetapan || "0000-00-00")));
    if (berlaku.length > 0) return berlaku[0].id;
    return rows.find((d) => d.tahapan === "murni")?.id ?? rows[0].id;
  }

  const pengajuan = await ambilSemua<any>((a, b) =>
    supabase.from("pengajuan_belanja").select("id, tanggal, dpa_id, dpa!inner(rekening_id, tahun_anggaran)")
      .eq("dpa.tahun_anggaran", tahun).order("id").range(a, b)
  );
  let dipindah = 0;
  for (const p of pengajuan) {
    const benar = resolveDpaId(p.dpa?.rekening_id, p.tanggal);
    if (benar && benar !== p.dpa_id) {
      const { error } = await supabase.from("pengajuan_belanja").update({ dpa_id: benar }).eq("id", p.id);
      if (error) throw new Error(error.message);
      dipindah += 1;
    }
  }
  return dipindah;
}
