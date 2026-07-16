"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addPejabat(formData: FormData) {
  const supabase = createClient();
  const jabatan = String(formData.get("jabatan"));
  const nama = String(formData.get("nama"));
  const nip = String(formData.get("nip"));
  const nomor_sk = String(formData.get("nomor_sk") || "") || null;
  const tanggal_sk = String(formData.get("tanggal_sk") || "") || null;
  const tahun_anggaran = Number(formData.get("tahun_anggaran"));
  const sub_kegiatan_id = String(formData.get("sub_kegiatan_id") || "") || null;

  const { error } = await supabase.from("pejabat_skpd").insert({
    jabatan,
    nama,
    nip,
    nomor_sk,
    tanggal_sk,
    tahun_anggaran,
    sub_kegiatan_id,
    aktif: true,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/pejabat");
}

export async function updatePejabat(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id"));
  const nama = String(formData.get("nama"));
  const nip = String(formData.get("nip"));
  const nomor_sk = String(formData.get("nomor_sk") || "") || null;
  const tanggal_sk = String(formData.get("tanggal_sk") || "") || null;
  const sub_kegiatan_id = String(formData.get("sub_kegiatan_id") || "") || null;

  const { error } = await supabase
    .from("pejabat_skpd")
    .update({ nama, nip, nomor_sk, tanggal_sk, sub_kegiatan_id })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/pejabat");
}

export async function deletePejabat(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id"));

  const { error } = await supabase.from("pejabat_skpd").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pejabat");
}
