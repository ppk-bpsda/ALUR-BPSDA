import type { SupabaseClient } from "@supabase/supabase-js";

export type LogAnggaran = {
  tahun_anggaran: number;
  tahapan: string;
  sumber: "manual" | "excel" | "salin";
  aksi: "tambah" | "ubah" | "hapus";
  rekening_id?: string | null;
  kode_rekening?: string | null;
  sumber_dana?: string | null;
  pagu_lama?: number | null;
  pagu_baru?: number | null;
  keterangan?: string | null;
};

/**
 * Catat riwayat perubahan pagu. TIDAK PERNAH melempar error: bila tabel
 * anggaran_log belum dibuat (migrasi belum dijalankan) pencatatan dilewati
 * diam-diam supaya penyimpanan pagu tidak ikut gagal.
 */
export async function catatLog(supabase: SupabaseClient, entri: LogAnggaran[]) {
  if (entri.length === 0) return;
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id ?? null;
    let username: string | null = null;
    if (userId) {
      const { data: p } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
      username = (p as any)?.username ?? null;
    }
    for (let i = 0; i < entri.length; i += 500) {
      const potong = entri.slice(i, i + 500).map((e) => ({ ...e, user_id: userId, username }));
      await supabase.from("anggaran_log").insert(potong);
    }
  } catch {
    /* tidak kritis */
  }
}
