"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addPenyedia(formData: FormData) {
  const supabase = createClient();
  const payload = {
    nama_penyedia: String(formData.get("nama_penyedia")),
    nama_direktur: String(formData.get("nama_direktur") || ""),
    alamat: String(formData.get("alamat") || ""),
    npwp: String(formData.get("npwp") || ""),
    rekening_bank: String(formData.get("rekening_bank") || ""),
  };
  const { error } = await supabase.from("penyedia").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath("/penyedia");
}

export async function deletePenyedia(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("penyedia").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/penyedia");
}
