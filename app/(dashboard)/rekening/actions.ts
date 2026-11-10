"use server";

import { createClient } from "@/lib/supabase/server";
import { getPeriode } from "@/lib/periode";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { failTo, okTo } from "@/lib/flash";
import { bersihkanKode, periksaKode, rapikanTeks, saranKodeBelanja } from "@/lib/anggaran/kode";

// Galat/sukses dilempar sebagai Pesan, lalu dibungkus jalankan() yang mengarahkan
// pengguna KEMBALI ke halaman asalnya (daftar, form tambah, atau form ubah) sehingga
// isian tidak hilang konteks. Hanya alamat di bawah /rekening yang diizinkan.
class Pesan extends Error {
  constructor(public tipe: "ok" | "gagal", public isi: unknown) { super(String((isi as any)?.message ?? isi)); }
}
function fail(message: unknown): never { throw new Pesan("gagal", message); }
function ok(message: string): never { throw new Pesan("ok", message); }

function tujuanKembali(fd: FormData, cadangan = "/rekening"): string {
  const k = String(fd.get("kembali") || "");
  return /^\/rekening(\/[A-Za-z0-9-]+){0,2}$/.test(k) ? k : cadangan;
}
async function jalankan(fd: FormData, fn: () => Promise<void>, sukses = "/rekening"): Promise<never> {
  const kembali = tujuanKembali(fd);
  try {
    await fn();
  } catch (e) {
    if (e instanceof Pesan) {
      if (e.tipe === "ok") return okTo(e.tipe === "ok" ? sukses : kembali, e.message);
      return failTo(kembali, e.isi);
    }
    throw e; // termasuk NEXT_REDIRECT
  }
  return redirect(sukses);
}

/** Angka dari <input type="number">: harus berisi angka valid (tidak diam-diam menjadi 0). */
function angkaWajib(v: FormDataEntryValue | null, nama: string): number {
  const s = String(v ?? "").trim();
  if (s === "") fail(`${nama} wajib diisi (isi 0 bila memang nol).`);
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) fail(`${nama} harus berupa angka dan tidak boleh negatif.`);
  return Math.round(n * 100) / 100;
}

/**
 * Cek kode belanja ke katalog resmi (ref_belanja). Bila katalog kosong/belum ada, dilewati.
 * Kode di luar katalog ditolak kecuali pengguna mencentang "kode di luar katalog"
 * -- ini yang menangkap salah ketik (mis. 00024 tertulis 00042) SEBELUM masuk database.
 */
async function pastikanDiKatalog(supabase: any, kodeBelanja: string, bolehLuar: boolean) {
  const { count, error } = await supabase.from("ref_belanja").select("kode_belanja", { count: "exact", head: true });
  if (error || !count) return; // katalog belum ada / kosong
  const { data: ada } = await supabase.from("ref_belanja").select("kode_belanja").eq("kode_belanja", kodeBelanja).maybeSingle();
  if (ada || bolehLuar) return;
  const { data: semua } = await supabase.from("ref_belanja").select("kode_belanja, nama_belanja").limit(2000);
  const saran = saranKodeBelanja(kodeBelanja, (semua ?? []).map((r: any) => r.kode_belanja));
  const nama = new Map<string, string>((semua ?? []).map((r: any) => [r.kode_belanja, r.nama_belanja]));
  fail(
    `Kode belanja ${kodeBelanja} tidak ada di katalog resmi -- kemungkinan salah ketik.` +
      (saran.length ? ` Mungkin maksudnya: ${saran.map((k) => `${k} (${nama.get(k)})`).join("; ")}.` : "") +
      ` Bila kode ini memang benar, centang "kode di luar katalog" lalu simpan lagi.`
  );
}

// ---------------------------------------------------------
// TAMBAH -- rekening baru (atau rekening lama yang belum punya pagu di
// tahapan aktif). rekening_belanja adalah "master" per sub kegiatan +
// kode rekening + sumber dana (dipakai bersama ke-3 tahapan). Bila master
// SUDAH ada, dipakai apa adanya (isian uraian/jenis di form TIDAK menimpa
// master lama -- koreksi dilakukan lewat tombol Simpan di barisnya, tercatat).
// Semua perubahan tercatat otomatis di Riwayat Pagu (trigger database).
// ---------------------------------------------------------
export async function addRekening(formData: FormData) {
  return jalankan(formData, async () => {
  const { tahun, tahapan } = await getPeriode();
  const supabase = await createClient();

  const sub_kegiatan_id = String(formData.get("sub_kegiatan_id") || "");
  const kodeInput = String(formData.get("kode_rekening") || "");
  const jenis_belanja = rapikanTeks(formData.get("jenis_belanja"));
  const kelompok_belanja = String(formData.get("kelompok_belanja") || "").trim() || null;
  const sumber_dana = rapikanTeks(formData.get("sumber_dana"));
  const pptk_id = String(formData.get("pptk_id") || "") || null;
  const bolehLuarKatalog = formData.get("di_luar_katalog") === "1";

  if (!sub_kegiatan_id || !kodeInput.trim() || !jenis_belanja || !sumber_dana) {
    fail("Sub Kegiatan, Kode Rekening, Jenis Belanja, dan Sumber Dana wajib diisi.");
  }
  const pagu_anggaran = angkaWajib(formData.get("pagu_anggaran"), "Pagu Anggaran");

  const { data: subTerpilih } = await supabase
    .from("sub_kegiatan").select("kode_sub_kegiatan").eq("id", sub_kegiatan_id).maybeSingle();
  if (!subTerpilih) fail("Sub Kegiatan yang dipilih tidak ditemukan.");

  // Kode lengkap = kode sub kegiatan + kode belanja. Yang diisi 6 segmen saja dilengkapi otomatis;
  // awalan yang tidak cocok dengan sub kegiatan terpilih ditolak (mencegah salah tempat / dobel).
  const hk = periksaKode(kodeInput, subTerpilih!.kode_sub_kegiatan);
  if (!hk.ok) fail(hk.galat);
  await pastikanDiKatalog(supabase, hk.kodeBelanja, bolehLuarKatalog);

  // Pakai master yang sudah ada (tanpa menimpa), atau buat baru.
  const { data: kandidat, error: errCari } = await supabase
    .from("rekening_belanja").select("id, sumber_dana")
    .eq("sub_kegiatan_id", sub_kegiatan_id).eq("kode_rekening", hk.kode);
  if (errCari) fail(errCari.message);
  let rekeningId = (kandidat ?? []).find((r: any) => rapikanTeks(r.sumber_dana).toLowerCase() === sumber_dana.toLowerCase())?.id as string | undefined;
  if (!rekeningId) {
    const { data: baru, error: errRek } = await supabase
      .from("rekening_belanja")
      .insert({ sub_kegiatan_id, kode_rekening: hk.kode, jenis_belanja, kelompok_belanja, sumber_dana })
      .select("id").single();
    if (errRek) fail(errRek.message);
    rekeningId = baru!.id as string;
  }

  const { data: sudahAda } = await supabase
    .from("dpa").select("id").eq("rekening_id", rekeningId).eq("tahun_anggaran", tahun).eq("tahapan", tahapan).maybeSingle();
  if (sudahAda) fail("Rekening ini sudah punya pagu di tahapan aktif. Ubah pagunya langsung di tabel (tombol Simpan di barisnya).");

  const { error: errDpa } = await supabase.from("dpa").insert({
    rekening_id: rekeningId, tahun_anggaran: tahun, tahapan, pagu_anggaran, pptk_id,
  });
  if (errDpa) fail(errDpa.message);

  revalidatePath("/rekening");
  ok(`Rekening ${hk.kode} ditambahkan.`);
  });
}

// ---------------------------------------------------------
// EDIT -- baris yang sudah ada (di tahapan aktif).
//  - Identitas rekening (kode, sub kegiatan, uraian, sumber dana, jenis) adalah MASTER
//    yang dipakai semua tahapan: hanya ditulis bila benar-benar berubah, divalidasi
//    sama ketatnya dengan tambah, dan tercatat (nilai lama -> baru) di Riwayat Pagu.
//  - Pagu hanya berlaku di tahapan aktif; ditolak bila sudah diubah pengguna lain.
// ---------------------------------------------------------
export async function updateRekening(formData: FormData) {
  return jalankan(formData, async () => {
  const supabase = await createClient();

  const dpa_id = String(formData.get("dpa_id") || "");
  const rekening_id = String(formData.get("rekening_id") || "");
  const sub_kegiatan_id = String(formData.get("sub_kegiatan_id") || "");
  const kodeInput = String(formData.get("kode_rekening") || "");
  const jenis_belanja = rapikanTeks(formData.get("jenis_belanja"));
  const kelompok_belanja = String(formData.get("kelompok_belanja") || "").trim() || null;
  const sumber_dana = rapikanTeks(formData.get("sumber_dana"));
  const pptk_id = String(formData.get("pptk_id") || "") || null;
  const paguLamaRaw = String(formData.get("pagu_lama") ?? "").trim();
  const bolehLuarKatalog = formData.get("di_luar_katalog") === "1";

  if (!dpa_id || !rekening_id) fail("Data baris tidak valid.");
  if (!sub_kegiatan_id || !kodeInput.trim() || !jenis_belanja || !sumber_dana) {
    fail("Sub Kegiatan, Kode Rekening, Jenis Belanja, dan Sumber Dana wajib diisi.");
  }
  const pagu_anggaran = angkaWajib(formData.get("pagu_anggaran"), "Pagu Anggaran");

  const [{ data: lama }, { data: subBaru }] = await Promise.all([
    supabase.from("rekening_belanja").select("sub_kegiatan_id, kode_rekening, jenis_belanja, kelompok_belanja, sumber_dana").eq("id", rekening_id).maybeSingle(),
    supabase.from("sub_kegiatan").select("kode_sub_kegiatan").eq("id", sub_kegiatan_id).maybeSingle(),
  ]);
  if (!lama) fail("Rekening tidak ditemukan (mungkin sudah dihapus pengguna lain). Muat ulang halaman.");
  if (!subBaru) fail("Sub Kegiatan yang dipilih tidak ditemukan.");

  // --- master rekening: tulis hanya bila berubah
  const kodeBerubah = bersihkanKode(kodeInput) !== lama!.kode_rekening;
  const subBerubah = sub_kegiatan_id !== lama!.sub_kegiatan_id;
  let kode_rekening = lama!.kode_rekening as string;
  if (kodeBerubah || subBerubah) {
    const hk = periksaKode(kodeInput, subBaru!.kode_sub_kegiatan);
    if (!hk.ok) fail(hk.galat);
    kode_rekening = hk.kode;
    if (kodeBerubah) await pastikanDiKatalog(supabase, hk.kodeBelanja, bolehLuarKatalog);
  }
  const masterPatch: Record<string, unknown> = {};
  if (subBerubah) masterPatch.sub_kegiatan_id = sub_kegiatan_id;
  if (kode_rekening !== lama!.kode_rekening) masterPatch.kode_rekening = kode_rekening;
  if (jenis_belanja !== rapikanTeks(lama!.jenis_belanja)) masterPatch.jenis_belanja = jenis_belanja;
  if (sumber_dana.toLowerCase() !== rapikanTeks(lama!.sumber_dana).toLowerCase()) masterPatch.sumber_dana = sumber_dana;
  if ((kelompok_belanja ?? "") !== (lama!.kelompok_belanja ?? "")) masterPatch.kelompok_belanja = kelompok_belanja;

  if (Object.keys(masterPatch).length > 0) {
    const { error } = await supabase.from("rekening_belanja").update(masterPatch).eq("id", rekening_id);
    if (error) fail(error.message);
  }

  // --- pagu & PPTK tahapan ini (dengan pengaman bentrok antarpengguna)
  let q = supabase.from("dpa").update({ pagu_anggaran, pptk_id }).eq("id", dpa_id);
  if (paguLamaRaw !== "" && Number.isFinite(Number(paguLamaRaw))) q = q.eq("pagu_anggaran", Number(paguLamaRaw));
  const { data: terubah, error: errDpa } = await q.select("id");
  if (errDpa) fail(errDpa.message);
  if (!terubah || terubah.length === 0) {
    fail("Pagu baris ini sudah diubah pengguna lain sejak halaman dibuka. Muat ulang halaman lalu ulangi perubahan Anda.");
  }

  revalidatePath("/rekening");
  const info: string[] = [];
  if (masterPatch.kode_rekening) info.push(`kode ${lama!.kode_rekening} → ${kode_rekening}`);
  if (masterPatch.sumber_dana) info.push(`sumber dana ${lama!.sumber_dana} → ${sumber_dana}`);
  if (masterPatch.jenis_belanja) info.push("uraian diubah");
  ok(info.length ? `Tersimpan. Perubahan master (berlaku semua tahapan): ${info.join("; ")}. Tercatat di Riwayat Pagu.` : "Tersimpan.");
  });
}

// ---------------------------------------------------------
// HAPUS -- hapus pagu (dpa) di tahapan aktif untuk baris ini. Kalau
// setelah itu rekening tsb sudah tidak dipakai tahapan manapun lagi,
// master rekening_belanja-nya ikut dibersihkan supaya tidak jadi data
// yatim. Kalau rekening masih punya pengajuan belanja tercatat (FK
// pengajuan_belanja.dpa_id), penghapusan akan gagal dengan pesan jelas
// -- ini disengaja supaya data transaksi tidak pernah hilang diam-diam.
// Nilai yang dihapus tetap tersimpan di Riwayat Pagu (trigger database).
// ---------------------------------------------------------
export async function deleteRekening(formData: FormData) {
  return jalankan(formData, async () => {
  const supabase = await createClient();
  const dpa_id = String(formData.get("dpa_id") || "");
  const rekening_id = String(formData.get("rekening_id") || "");
  if (!dpa_id || !rekening_id) fail("Data baris tidak valid.");

  const { error: errDelete } = await supabase.from("dpa").delete().eq("id", dpa_id);
  if (errDelete) {
    if (errDelete.message.toLowerCase().includes("foreign key")) {
      fail("Tidak bisa dihapus -- rekening ini sudah punya Pengajuan Belanja tercatat di tahapan ini.");
    }
    fail(errDelete.message);
  }

  const { count } = await supabase.from("dpa").select("id", { count: "exact", head: true }).eq("rekening_id", rekening_id);
  if (!count) await supabase.from("rekening_belanja").delete().eq("id", rekening_id);

  revalidatePath("/rekening");
  ok("Rekening dihapus dari tahapan ini. Nilai sebelumnya tersimpan di Riwayat Pagu.");
  });
}

// ---------------------------------------------------------
// TAMBAH KEGIATAN / SUB KEGIATAN BARU -- tidak lagi "upsert diam-diam":
// kode yang sudah ada ditolak dengan menyebut namanya (dulu nama/induknya
// bisa tertimpa tanpa jejak). Kode sub kegiatan wajib berawalan kode kegiatan.
// ---------------------------------------------------------
export async function addKegiatan(formData: FormData) {
  return jalankan(formData, async () => {
  const { tahun } = await getPeriode();
  const supabase = await createClient();

  const program_id = String(formData.get("program_id") || "");
  const kode_kegiatan = String(formData.get("kode_kegiatan") || "").replace(/\s+/g, "");
  const nama_kegiatan = rapikanTeks(formData.get("nama_kegiatan"));
  if (!program_id || !kode_kegiatan || !nama_kegiatan) fail("Program, Kode Kegiatan, dan Nama Kegiatan wajib diisi.");

  const { data: prog } = await supabase.from("program").select("kode_program").eq("id", program_id).maybeSingle();
  if (prog && !kode_kegiatan.startsWith(`${prog.kode_program}.`)) {
    fail(`Kode kegiatan harus berawalan kode program ${prog.kode_program}. (mis. ${prog.kode_program}.2.01)`);
  }
  const { data: ada } = await supabase.from("kegiatan").select("nama_kegiatan").eq("kode_kegiatan", kode_kegiatan).eq("tahun_anggaran", tahun).maybeSingle();
  if (ada) fail(`Kode kegiatan ${kode_kegiatan} sudah ada (${ada.nama_kegiatan}).`);

  const { error } = await supabase.from("kegiatan").insert({ program_id, kode_kegiatan, nama_kegiatan, tahun_anggaran: tahun });
  if (error) fail(error.message);

  revalidatePath("/rekening");
  ok(`Kegiatan ${kode_kegiatan} ditambahkan.`);
  });
}

export async function addSubKegiatan(formData: FormData) {
  return jalankan(formData, async () => {
  const { tahun } = await getPeriode();
  const supabase = await createClient();

  const kegiatan_id = String(formData.get("kegiatan_id") || "");
  const kode_sub_kegiatan = String(formData.get("kode_sub_kegiatan") || "").replace(/\s+/g, "");
  const nama_sub_kegiatan = rapikanTeks(formData.get("nama_sub_kegiatan"));
  if (!kegiatan_id || !kode_sub_kegiatan || !nama_sub_kegiatan) fail("Kegiatan, Kode Sub Kegiatan, dan Nama Sub Kegiatan wajib diisi.");

  const { data: keg } = await supabase.from("kegiatan").select("kode_kegiatan").eq("id", kegiatan_id).maybeSingle();
  if (keg && !kode_sub_kegiatan.startsWith(`${keg.kode_kegiatan}.`)) {
    fail(`Kode sub kegiatan harus berawalan kode kegiatan ${keg.kode_kegiatan}. (mis. ${keg.kode_kegiatan}.0001)`);
  }
  const { data: ada } = await supabase.from("sub_kegiatan").select("nama_sub_kegiatan").eq("kode_sub_kegiatan", kode_sub_kegiatan).eq("tahun_anggaran", tahun).maybeSingle();
  if (ada) fail(`Kode sub kegiatan ${kode_sub_kegiatan} sudah ada (${ada.nama_sub_kegiatan}).`);

  const { error } = await supabase.from("sub_kegiatan").insert({ kegiatan_id, kode_sub_kegiatan, nama_sub_kegiatan, tahun_anggaran: tahun });
  if (error) fail(error.message);

  revalidatePath("/rekening");
  ok(`Sub kegiatan ${kode_sub_kegiatan} ditambahkan.`);
  });
}

// ---------------------------------------------------------
// SALIN DARI TAHAPAN LAIN -- untuk mulai penyusunan tahapan baru (mis.
// "Perubahan") dari baseline tahapan sebelumnya (mis. "Pergeseran").
// Hanya MENAMBAHKAN rekening yang belum punya pagu di tahapan aktif.
// Satu transaksi (fungsi SQL salin_pagu_tahapan) dan tercatat di riwayat.
// ---------------------------------------------------------
export async function salinDariTahapan(formData: FormData) {
  return jalankan(formData, async () => {
  const { tahun, tahapan } = await getPeriode();
  const supabase = await createClient();
  const dariTahapan = String(formData.get("dari_tahapan") || "");
  if (!dariTahapan || dariTahapan === tahapan) fail("Pilih tahapan sumber yang berbeda dari tahapan aktif.");

  const { data, error } = await supabase.rpc("salin_pagu_tahapan", { p_tahun: tahun, p_dari: dariTahapan, p_ke: tahapan });
  if (error) {
    if (/could not find the function|PGRST202/i.test(`${error.message} ${error.code}`)) {
      fail("Jalankan dulu migrasi 20260810000000_audit_pagu_dan_simpan_atomik.sql di SQL Editor Supabase.");
    }
    fail(error.message);
  }

  revalidatePath("/rekening");
  ok(`${Number(data) || 0} rekening disalin dari ${dariTahapan}. Yang sudah punya pagu di tahapan ini tidak ditimpa.`);
  });
}
