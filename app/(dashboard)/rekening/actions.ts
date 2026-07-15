"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateDpa(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id"));
  const pagu_anggaran = Number(formData.get("pagu_anggaran"));
  const tahapan = String(formData.get("tahapan"));

  const { error } = await supabase.from("dpa").update({ pagu_anggaran, tahapan }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/rekening");
}
