"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function upsertPejabat(formData: FormData) {
  const supabase = createClient();
  const jabatan = String(formData.get("jabatan"));
  const nama = String(formData.get("nama"));
  const nip = String(formData.get("nip"));
  const tahun_anggaran = Number(formData.get("tahun_anggaran"));

  const { error } = await supabase
    .from("pejabat_skpd")
    .upsert({ jabatan, nama, nip, tahun_anggaran }, { onConflict: "jabatan,tahun_anggaran" });

  if (error) throw new Error(error.message);
  revalidatePath("/pejabat");
}
