"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updatePengaturan(formData: FormData) {
  const supabase = createClient();
  const nama_skpd_baris1 = String(formData.get("nama_skpd_baris1") || "").trim();
  const nama_skpd_baris2 = String(formData.get("nama_skpd_baris2") || "").trim();

  if (!nama_skpd_baris1) {
    throw new Error("Nama SKPD baris 1 wajib diisi.");
  }

  const { error } = await supabase
    .from("pengaturan_aplikasi")
    .upsert({ id: 1, nama_skpd_baris1, nama_skpd_baris2, updated_at: new Date().toISOString() });

  if (error) throw new Error(error.message);
  revalidatePath("/pengaturan");
}
