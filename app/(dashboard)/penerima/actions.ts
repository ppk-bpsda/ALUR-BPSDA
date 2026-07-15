"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addPenerima(formData: FormData) {
  const supabase = createClient();
  const payload = {
    nama_penerima: String(formData.get("nama_penerima")),
    keterangan: String(formData.get("keterangan") || ""),
  };
  const { error } = await supabase.from("penerima").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath("/penerima");
}

export async function deletePenerima(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("penerima").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/penerima");
}
