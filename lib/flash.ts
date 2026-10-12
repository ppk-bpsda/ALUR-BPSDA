import { redirect } from "next/navigation";

/**
 * Ubah pesan error teknis (umumnya dari Postgres/PostgREST, berbahasa
 * Inggris) menjadi kalimat yang dimengerti pegawai.
 */
export function friendlyError(raw: unknown): string {
  const msg = String((raw as any)?.message ?? raw ?? "").trim();
  const m = msg.toLowerCase();
  if (!msg) return "Terjadi kesalahan. Silakan coba lagi.";
  if (m.includes("duplicate key") || m.includes("already exists") || m.includes("unique constraint")) {
    return "Data dengan kode/nama yang sama sudah ada. Periksa kembali isian Anda.";
  }
  if (m.includes("foreign key") || m.includes("violates foreign key")) {
    return "Data ini tidak dapat diubah/dihapus karena masih dipakai oleh data lain (mis. sudah ada pengajuan).";
  }
  if (m.includes("row-level security") || m.includes("permission denied")) {
    return "Anda tidak memiliki akses untuk tindakan ini. Silakan login ulang atau hubungi administrator.";
  }
  if (m.includes("null value in column") || m.includes("not-null")) {
    return "Ada isian wajib yang masih kosong.";
  }
  if (m.includes("invalid input syntax") || m.includes("out of range")) {
    return "Format isian tidak valid (periksa angka dan tanggal).";
  }
  if (m.includes("fetch failed") || m.includes("network") || m.includes("timeout") || m.includes("econnrefused")) {
    return "Database tidak dapat dihubungi. Periksa koneksi internet atau status project Supabase, lalu coba lagi.";
  }
  if (m.includes("jwt") || m.includes("not authenticated")) {
    return "Sesi berakhir. Silakan login kembali.";
  }
  return msg.length > 300 ? msg.slice(0, 300) + "…" : msg;
}

/**
 * Dipakai di server action menggantikan `throw new Error(...)`.
 *
 * Di produksi Next.js MENYEMBUNYIKAN pesan dari error yang dilempar server
 * action -- pegawai hanya melihat halaman "terjadi kendala" tanpa tahu apa
 * yang salah. Dengan redirect membawa `?galat=`, pesannya tampil sebagai
 * banner di halaman yang sama (lihat components/FlashBanner.tsx).
 */
export function failTo(path: string, message: unknown): never {
  const text = friendlyError(message);
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}galat=${encodeURIComponent(text)}`);
}
