"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setPeriodeCookies, TAHUN_OPTIONS, TAHAPAN_OPTIONS } from "@/lib/periode";

export async function gantiPeriode(formData: FormData) {
  const tahun = Number(formData.get("tahun_anggaran"));
  const tahapan = String(formData.get("tahapan") || "");

  if (
    !(TAHUN_OPTIONS as readonly number[]).includes(tahun) ||
    !TAHAPAN_OPTIONS.some((t) => t.value === tahapan)
  ) {
    redirect("/periode");
  }

  setPeriodeCookies(tahun, tahapan);
  redirect("/");
}

// ---------------------------------------------------------
// TANGGAL PENETAPAN TAHAPAN (Murni/Pergeseran/Perubahan)
// ---------------------------------------------------------
// Tanggal-tanggal ini menentukan tahapan mana yang berlaku untuk satu
// transaksi (lihat resolveDpaId di components/PengajuanForm.tsx --
// LOGIKA DI BAWAH INI HARUS SAMA PERSIS dengan fungsi itu supaya
// pengajuan baru (dihitung di form) dan pengajuan lama (disortir ulang
// di sini) selalu berakhir di dpa_id yang sama untuk tanggal yang sama):
//   - DPA tanpa tanggal_penetapan (biasanya Murni) dianggap berlaku
//     sejak awal Tahun Anggaran.
//   - Untuk satu rekening, transaksi masuk ke DPA dengan tanggal_penetapan
//     PALING BARU yang tetap <= tanggal transaksi.
//
// Submit form ini akan (1) menyimpan tanggal penetapan tiap tahapan ke
// SEMUA baris DPA tahun anggaran terkait, lalu (2) otomatis menyortir
// ULANG seluruh Pengajuan Belanja tahun itu ke dpa_id (tahapan) yang
// seharusnya berlaku berdasarkan tanggal transaksi masing-masing --
// jadi tidak perlu lagi migrasi SQL manual tiap kali tanggal berubah.
export async function simpanTanggalTahapan(formData: FormData) {
  const tahun = Number(formData.get("tahun_anggaran"));
  if (!(TAHUN_OPTIONS as readonly number[]).includes(tahun)) {
    throw new Error("Tahun Anggaran tidak valid.");
  }

  const tanggalPerTahapan: Record<string, string | null> = {
    murni: (String(formData.get("tanggal_murni") || "").trim() || null),
    pergeseran: (String(formData.get("tanggal_pergeseran") || "").trim() || null),
    perubahan: (String(formData.get("tanggal_perubahan") || "").trim() || null),
  };

  // Validasi urutan: kalau diisi, tanggal Pergeseran harus setelah tanggal
  // Murni (kalau Murni diisi), dan tanggal Perubahan harus setelah tanggal
  // Pergeseran (kalau Pergeseran diisi) -- supaya urutan tahapan tetap
  // masuk akal secara kronologis.
  const { murni, pergeseran, perubahan } = tanggalPerTahapan;
  if (murni && pergeseran && pergeseran <= murni) {
    throw new Error("Tanggal penetapan Pergeseran harus setelah tanggal penetapan Murni.");
  }
  if (pergeseran && perubahan && perubahan <= pergeseran) {
    throw new Error("Tanggal penetapan Perubahan harus setelah tanggal penetapan Pergeseran.");
  }
  if (murni && perubahan && !pergeseran && perubahan <= murni) {
    throw new Error("Tanggal penetapan Perubahan harus setelah tanggal penetapan Murni.");
  }

  const supabase = createClient();

  // 1) Simpan tanggal penetapan ke semua baris DPA tahun ini per tahapan.
  for (const t of TAHAPAN_OPTIONS) {
    const { error } = await supabase
      .from("dpa")
      .update({ tanggal_penetapan: tanggalPerTahapan[t.value] })
      .eq("tahun_anggaran", tahun)
      .eq("tahapan", t.value);
    if (error) throw new Error(`Gagal menyimpan tanggal ${t.label}: ${error.message}`);
  }

  // 2) Sortir ulang: ambil semua DPA (per rekening) & semua Pengajuan
  // Belanja tahun ini, lalu hitung ulang dpa_id yang seharusnya berlaku
  // untuk tiap pengajuan berdasarkan tanggalnya -- identik dengan
  // resolveDpaId() di PengajuanForm.tsx.
  const { data: dpaRows, error: errDpa } = await supabase
    .from("dpa")
    .select("id, rekening_id, tahapan, tanggal_penetapan")
    .eq("tahun_anggaran", tahun);
  if (errDpa) throw new Error(errDpa.message);

  const dpaByRekening = new Map<string, any[]>();
  for (const d of dpaRows ?? []) {
    const list = dpaByRekening.get(d.rekening_id) ?? [];
    list.push(d);
    dpaByRekening.set(d.rekening_id, list);
  }

  function resolveDpaId(rekeningId: string, tanggal: string): string | null {
    const rows = dpaByRekening.get(rekeningId) ?? [];
    if (rows.length === 0) return null;
    const berlaku = rows
      .filter((d: any) => !d.tanggal_penetapan || d.tanggal_penetapan <= tanggal)
      .sort((a: any, b: any) =>
        String(b.tanggal_penetapan || "0000-00-00").localeCompare(String(a.tanggal_penetapan || "0000-00-00"))
      );
    if (berlaku.length > 0) return berlaku[0].id;
    return rows.find((d: any) => d.tahapan === "murni")?.id ?? rows[0].id;
  }

  const { data: pengajuanRows, error: errPengajuan } = await supabase
    .from("pengajuan_belanja")
    .select("id, tanggal, dpa_id, dpa!inner(rekening_id, tahun_anggaran)")
    .eq("dpa.tahun_anggaran", tahun);
  if (errPengajuan) throw new Error(errPengajuan.message);

  let jumlahDisortir = 0;
  for (const p of pengajuanRows ?? []) {
    const rekeningId = (p as any).dpa?.rekening_id;
    const dpaBenar = resolveDpaId(rekeningId, (p as any).tanggal);
    if (dpaBenar && dpaBenar !== (p as any).dpa_id) {
      const { error: errUpdate } = await supabase
        .from("pengajuan_belanja")
        .update({ dpa_id: dpaBenar })
        .eq("id", (p as any).id);
      if (errUpdate) throw new Error(errUpdate.message);
      jumlahDisortir += 1;
    }
  }

  revalidatePath("/periode");
  revalidatePath("/pengajuan");
  revalidatePath("/rekap");
  revalidatePath("/laporan");
  revalidatePath("/");

  redirect(`/periode?tanggal_tersimpan=1&disortir=${jumlahDisortir}`);
}
