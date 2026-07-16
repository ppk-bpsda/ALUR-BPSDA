"use server";

import { createClient } from "@/lib/supabase/server";
import { getPeriode } from "@/lib/periode";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------
// TAMBAH -- rekening baru (atau rekening lama yang belum punya pagu di
// tahapan aktif). rekening_belanja bersifat "master" per sub kegiatan +
// kode rekening + sumber dana (dipakai bersama oleh ke-3 tahapan), jadi
// kita upsert dulu masternya baru upsert pagu (dpa) untuk tahun+tahapan
// yang sedang aktif.
// ---------------------------------------------------------
export async function addRekening(formData: FormData) {
  const { tahun, tahapan } = getPeriode();
  const supabase = createClient();

  const sub_kegiatan_id = String(formData.get("sub_kegiatan_id") || "");
  const kode_rekening = String(formData.get("kode_rekening") || "").trim();
  const jenis_belanja = String(formData.get("jenis_belanja") || "").trim();
  const kelompok_belanja = String(formData.get("kelompok_belanja") || "").trim() || null;
  const sumber_dana = String(formData.get("sumber_dana") || "").trim();
  const pptk_id = String(formData.get("pptk_id") || "") || null;
  const pagu_anggaran = Number(formData.get("pagu_anggaran") || 0);

  if (!sub_kegiatan_id || !kode_rekening || !jenis_belanja || !sumber_dana) {
    throw new Error("Sub Kegiatan, Kode Rekening, Jenis Belanja, dan Sumber Dana wajib diisi.");
  }

  const { data: rekening, error: errRekening } = await supabase
    .from("rekening_belanja")
    .upsert(
      { sub_kegiatan_id, kode_rekening, jenis_belanja, kelompok_belanja, sumber_dana },
      { onConflict: "sub_kegiatan_id,kode_rekening,sumber_dana" }
    )
    .select("id")
    .single();

  if (errRekening) throw new Error(errRekening.message);

  const { error: errDpa } = await supabase.from("dpa").upsert(
    {
      rekening_id: rekening.id,
      tahun_anggaran: tahun,
      tahapan,
      pagu_anggaran,
      pptk_id,
    },
    { onConflict: "rekening_id,tahun_anggaran,tahapan" }
  );
  if (errDpa) throw new Error(errDpa.message);

  revalidatePath("/rekening");
}

// ---------------------------------------------------------
// EDIT -- baris yang sudah ada (di tahapan aktif). Bisa ubah kode
// rekening, sub kegiatan, jenis belanja, sumber dana, PPTK, dan pagu.
// ---------------------------------------------------------
export async function updateRekening(formData: FormData) {
  const supabase = createClient();

  const dpa_id = String(formData.get("dpa_id") || "");
  const rekening_id = String(formData.get("rekening_id") || "");
  const sub_kegiatan_id = String(formData.get("sub_kegiatan_id") || "");
  const kode_rekening = String(formData.get("kode_rekening") || "").trim();
  const jenis_belanja = String(formData.get("jenis_belanja") || "").trim();
  const kelompok_belanja = String(formData.get("kelompok_belanja") || "").trim() || null;
  const sumber_dana = String(formData.get("sumber_dana") || "").trim();
  const pptk_id = String(formData.get("pptk_id") || "") || null;
  const pagu_anggaran = Number(formData.get("pagu_anggaran") || 0);

  if (!dpa_id || !rekening_id) throw new Error("Data baris tidak valid.");
  if (!sub_kegiatan_id || !kode_rekening || !jenis_belanja || !sumber_dana) {
    throw new Error("Sub Kegiatan, Kode Rekening, Jenis Belanja, dan Sumber Dana wajib diisi.");
  }

  const { error: errRekening } = await supabase
    .from("rekening_belanja")
    .update({ sub_kegiatan_id, kode_rekening, jenis_belanja, kelompok_belanja, sumber_dana })
    .eq("id", rekening_id);
  if (errRekening) throw new Error(errRekening.message);

  const { error: errDpa } = await supabase
    .from("dpa")
    .update({ pagu_anggaran, pptk_id })
    .eq("id", dpa_id);
  if (errDpa) throw new Error(errDpa.message);

  revalidatePath("/rekening");
}

// ---------------------------------------------------------
// HAPUS -- hapus pagu (dpa) di tahapan aktif untuk baris ini. Kalau
// setelah itu rekening tsb sudah tidak dipakai tahapan manapun lagi,
// master rekening_belanja-nya ikut dibersihkan supaya tidak jadi data
// yatim. Kalau rekening masih punya pengajuan belanja tercatat (FK
// pengajuan_belanja.dpa_id), penghapusan akan gagal dengan pesan jelas
// -- ini disengaja supaya data transaksi tidak pernah hilang diam-diam.
// ---------------------------------------------------------
export async function deleteRekening(formData: FormData) {
  const supabase = createClient();
  const dpa_id = String(formData.get("dpa_id") || "");
  const rekening_id = String(formData.get("rekening_id") || "");
  if (!dpa_id || !rekening_id) throw new Error("Data baris tidak valid.");

  const { error: errDelete } = await supabase.from("dpa").delete().eq("id", dpa_id);
  if (errDelete) {
    if (errDelete.message.toLowerCase().includes("foreign key")) {
      throw new Error(
        "Tidak bisa dihapus -- rekening ini sudah punya Pengajuan Belanja tercatat di tahapan ini."
      );
    }
    throw new Error(errDelete.message);
  }

  const { count } = await supabase
    .from("dpa")
    .select("id", { count: "exact", head: true })
    .eq("rekening_id", rekening_id);

  if (!count) {
    await supabase.from("rekening_belanja").delete().eq("id", rekening_id);
  }

  revalidatePath("/rekening");
}
