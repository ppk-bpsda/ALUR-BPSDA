"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { failTo } from "@/lib/flash";
import { isUuid } from "@/lib/auth";

const PATH = "/perjalanan-dinas/pegawai";
const s = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);

function baca(fd: FormData) {
  const nama = s(fd.get("nama"), 200);
  const nip = s(fd.get("nip"), 40).replace(/\s+/g, "");
  if (!nama) failTo(PATH, "Nama pegawai wajib diisi.");
  if (nip.length < 8) failTo(PATH, "NIP wajib diisi (minimal 8 digit).");
  return {
    nama, nip,
    pangkat_gol: s(fd.get("pangkat_gol"), 100) || null,
    jabatan: s(fd.get("jabatan"), 250) || null,
  };
}

export async function addPegawai(fd: FormData) {
  const supabase = await createClient();
  const data = baca(fd);
  const { data: maks } = await supabase.from("perjadin_pegawai").select("urut").order("urut", { ascending: false, nullsFirst: false }).limit(1);
  const { error } = await supabase.from("perjadin_pegawai").insert({ ...data, urut: ((maks ?? [])[0]?.urut ?? 0) + 1 });
  if (error) failTo(PATH, error.message);
  revalidatePath(PATH);
  redirect(`${PATH}?ok=${encodeURIComponent("Pegawai ditambahkan.")}`);
}

export async function updatePegawai(fd: FormData) {
  const id = s(fd.get("id"), 50);
  if (!isUuid(id)) failTo(PATH, "ID tidak valid.");
  const supabase = await createClient();
  const { error } = await supabase.from("perjadin_pegawai").update({ ...baca(fd), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) failTo(PATH, error.message);
  revalidatePath(PATH);
  redirect(`${PATH}?ok=${encodeURIComponent("Data pegawai diperbarui.")}`);
}

export async function deletePegawai(fd: FormData) {
  const id = s(fd.get("id"), 50);
  if (!isUuid(id)) failTo(PATH, "ID tidak valid.");
  const supabase = await createClient();
  // Kuitansi lama tetap utuh: data peserta sudah berupa salinan (snapshot).
  const { error } = await supabase.from("perjadin_pegawai").delete().eq("id", id);
  if (error) failTo(PATH, error.message);
  revalidatePath(PATH);
  redirect(`${PATH}?ok=${encodeURIComponent("Pegawai dihapus.")}`);
}
