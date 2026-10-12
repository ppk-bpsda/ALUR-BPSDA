"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { failTo } from "@/lib/flash";

// Pesan error tampil sebagai banner di halaman (bukan halaman error umum).
function fail(message: unknown): never {
  return failTo("/pengaturan", message);
}

export async function updatePengaturan(formData: FormData) {
  const supabase = await createClient();
  const nama_skpd_baris1 = String(formData.get("nama_skpd_baris1") || "").trim();
  const nama_skpd_baris2 = String(formData.get("nama_skpd_baris2") || "").trim();

  if (!nama_skpd_baris1) {
    fail("Nama SKPD baris 1 wajib diisi.");
  }

  const { error } = await supabase
    .from("pengaturan_aplikasi")
    .upsert({ id: 1, nama_skpd_baris1, nama_skpd_baris2, updated_at: new Date().toISOString() });

  if (error) fail(error.message);
  revalidatePath("/pengaturan");
}
