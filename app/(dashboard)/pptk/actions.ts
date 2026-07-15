"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function upsertPptk(formData: FormData) {
  const supabase = createClient();
  const sub_kegiatan_id = String(formData.get("sub_kegiatan_id"));
  const nama = String(formData.get("nama"));
  const nip = String(formData.get("nip"));
  const nomor_sk = String(formData.get("nomor_sk") || "");
  const tahun_anggaran = Number(formData.get("tahun_anggaran"));

  const { error } = await supabase
    .from("pptk")
    .upsert(
      { sub_kegiatan_id, nama, nip, nomor_sk, tahun_anggaran },
      { onConflict: "sub_kegiatan_id,tahun_anggaran" }
    );

  if (error) throw new Error(error.message);
  revalidatePath("/pptk");
}
