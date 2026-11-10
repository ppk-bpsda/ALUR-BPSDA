import type { SupabaseClient } from "@supabase/supabase-js";
import type { RencanaBaris, Ringkasan } from "./pagu";

export type HasilTerapan = {
  tambah: number; ubah: number; sama: number; koreksi: number;
  subBaru: number; kegiatanBaru: number; programBaru: number; rekeningBaru: number;
  batch_id?: string;
};

/**
 * Menyimpan rencana hasil susunRencana() ke database lewat fungsi SQL terapkan_pagu():
 * SATU transaksi (gagal di baris mana pun = tidak ada yang tersimpan), satu kali panggilan
 * jaringan, dan setiap perubahan dicatat otomatis ke riwayat oleh trigger audit.
 * Hanya dipanggil bila TIDAK ada baris galat.
 */
export async function terapkanRencana(
  supabase: SupabaseClient,
  tahun: number,
  tahapan: string,
  rencana: RencanaBaris[],
  namaBerkas: string,
  ringkasan: Ringkasan
): Promise<HasilTerapan> {
  const baris = rencana
    .filter((r) => r.status === "baru" || r.status === "ubah" || r.status === "koreksi")
    .map((r) => ({
      baris: r.baris,
      rekening_id: r.rekening_id,
      koreksi: r.koreksi,
      // pengaman bentrok: pagu yang dilihat saat pratinjau harus masih sama saat disimpan
      pagu_lama: r.pagu_lama,
      harap_baru: r.dpa_id === null && r.rekening_id !== null,
      kode_program: r.kode_program, nama_program: r.nama_program,
      kode_kegiatan: r.kode_kegiatan, nama_kegiatan: r.nama_kegiatan,
      kode_sub_kegiatan: r.kode_sub_kegiatan, nama_sub_kegiatan: r.nama_sub_kegiatan,
      kode_rekening: r.kode_rekening, jenis_belanja: r.jenis_belanja,
      kelompok_belanja: r.kelompok_belanja, sumber_dana: r.sumber_dana,
      pagu_baru: r.pagu_baru, pptk_id: r.pptk_id,
    }));

  const { data, error } = await supabase.rpc("terapkan_pagu", {
    p_tahun: tahun,
    p_tahapan: tahapan,
    p_baris: baris,
    p_nama_berkas: namaBerkas,
    p_ringkasan: ringkasan,
  });
  if (error) {
    if (/could not find the function|PGRST202/i.test(`${error.message} ${error.code}`)) {
      throw new Error("Fitur simpan baru belum aktif: jalankan dulu migrasi supabase/migrations/20260810000000_audit_pagu_dan_simpan_atomik.sql di SQL Editor Supabase.");
    }
    throw new Error(error.message);
  }
  return data as HasilTerapan;
}
