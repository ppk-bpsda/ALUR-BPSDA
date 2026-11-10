"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setPeriodeCookies, TAHUN_OPTIONS, TAHAPAN_OPTIONS } from "@/lib/periode";
import { failTo } from "@/lib/flash";
import { terapkanTanggalTahapan, validasiUrutanTanggal } from "@/lib/anggaran/tahapan";

// Pesan error tampil sebagai banner di halaman (bukan halaman error umum).
function fail(message: unknown): never {
  return failTo("/periode", message);
}

export async function gantiPeriode(formData: FormData) {
  const tahun = Number(formData.get("tahun_anggaran"));
  const tahapan = String(formData.get("tahapan") || "");

  if (
    !(TAHUN_OPTIONS as readonly number[]).includes(tahun) ||
    !TAHAPAN_OPTIONS.some((t) => t.value === tahapan)
  ) {
    redirect("/periode");
  }

  await setPeriodeCookies(tahun, tahapan);
  redirect("/");
}

// ---------------------------------------------------------
// TANGGAL PENETAPAN TAHAPAN (Murni/Pergeseran/Perubahan)
// ---------------------------------------------------------
// Tanggal ini menentukan tahapan mana yang berlaku untuk satu transaksi.
// Submit form ini (1) menyimpan tanggal penetapan tiap tahapan ke semua baris
// DPA tahun terkait, lalu (2) menyortir ulang Pengajuan Belanja ke DPA yang
// berlaku menurut tanggal transaksinya. Logikanya ada di SATU tempat:
// lib/anggaran/tahapan.ts (memuat semua halaman data, tidak terpotong 1000 baris).
export async function simpanTanggalTahapan(formData: FormData) {
  const tahun = Number(formData.get("tahun_anggaran"));
  if (!(TAHUN_OPTIONS as readonly number[]).includes(tahun)) fail("Tahun Anggaran tidak valid.");

  const tanggal = {
    murni: String(formData.get("tanggal_murni") || "").trim() || null,
    pergeseran: String(formData.get("tanggal_pergeseran") || "").trim() || null,
    perubahan: String(formData.get("tanggal_perubahan") || "").trim() || null,
  };
  const galat = validasiUrutanTanggal(tanggal);
  if (galat) fail(galat);

  let disortir = 0;
  try {
    disortir = await terapkanTanggalTahapan(await createClient(), tahun, tanggal);
  } catch (e) {
    fail(e);
  }

  for (const p of ["/periode", "/pengajuan", "/rekap", "/laporan", "/"]) revalidatePath(p);
  redirect(`/periode?tanggal_tersimpan=1&disortir=${disortir}`);
}
