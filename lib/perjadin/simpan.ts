import { hitungHari } from "./tanggal";
import { isUuid } from "@/lib/auth";

export type InputPerjadin = {
  nomor_surat_tugas: string | null;
  tanggal_surat_tugas: string | null;
  maksud: string;
  tujuan_kota: string | null;
  tujuan_provinsi: string | null;
  tanggal_berangkat: string;
  tanggal_kembali: string;
  jenis_tarif: "perjalanan" | "rapat" | "diklat";
  tarif_uang_harian: number;
  biaya_lain: { uraian: string; jumlah: number }[];
  dpa_id: string | null;
  tanggal_kuitansi: string | null;
  nomor_kuitansi: string | null;
  pegawai_ids: string[];
  hasil_ekstraksi?: unknown;
};

const RE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const teks = (v: unknown, maks = 600) => {
  const s = String(v ?? "").trim().slice(0, maks);
  return s || null;
};

/** Validasi & normalisasi input dari klien. Mengembalikan pesan error (string) atau data bersih. */
export function validasiInput(raw: any): { error: string } | { data: InputPerjadin; lama_hari: number } {
  if (!raw || typeof raw !== "object") return { error: "Data tidak valid." };
  const maksud = teks(raw.maksud, 1000);
  if (!maksud) return { error: "Maksud/uraian perjalanan dinas wajib diisi." };
  if (!RE_ISO.test(raw.tanggal_berangkat) || !RE_ISO.test(raw.tanggal_kembali))
    return { error: "Tanggal berangkat & kembali wajib diisi." };
  const lama = hitungHari(raw.tanggal_berangkat, raw.tanggal_kembali);
  if (lama < 1 || lama > 366) return { error: "Tanggal kembali tidak boleh sebelum tanggal berangkat." };

  const ids: string[] = Array.isArray(raw.pegawai_ids) ? Array.from(new Set(raw.pegawai_ids.filter(isUuid))) as string[] : [];
  if (ids.length === 0) return { error: "Pilih minimal satu pegawai pelaksana." };
  if (ids.length > 30) return { error: "Maksimal 30 pegawai per Surat Tugas." };

  const tarif = Math.round(Number(raw.tarif_uang_harian));
  if (!isFinite(tarif) || tarif < 0 || tarif > 100_000_000) return { error: "Tarif uang harian tidak valid." };

  const lain = (Array.isArray(raw.biaya_lain) ? raw.biaya_lain : [])
    .slice(0, 12)
    .map((b: any) => ({ uraian: String(b?.uraian ?? "").trim().slice(0, 150), jumlah: Math.round(Number(b?.jumlah)) }))
    .filter((b: any) => b.uraian && isFinite(b.jumlah) && b.jumlah > 0 && b.jumlah <= 1_000_000_000);

  const jenis = ["perjalanan", "rapat", "diklat"].includes(raw.jenis_tarif) ? raw.jenis_tarif : "perjalanan";
  const tglOpt = (v: unknown) => (typeof v === "string" && RE_ISO.test(v) ? v : null);

  return {
    lama_hari: lama,
    data: {
      nomor_surat_tugas: teks(raw.nomor_surat_tugas, 120),
      tanggal_surat_tugas: tglOpt(raw.tanggal_surat_tugas),
      maksud,
      tujuan_kota: teks(raw.tujuan_kota, 120),
      tujuan_provinsi: teks(raw.tujuan_provinsi, 120),
      tanggal_berangkat: raw.tanggal_berangkat,
      tanggal_kembali: raw.tanggal_kembali,
      jenis_tarif: jenis,
      tarif_uang_harian: tarif,
      biaya_lain: lain,
      dpa_id: isUuid(raw.dpa_id) ? raw.dpa_id : null,
      tanggal_kuitansi: tglOpt(raw.tanggal_kuitansi),
      nomor_kuitansi: teks(raw.nomor_kuitansi, 80),
      pegawai_ids: ids,
      hasil_ekstraksi: raw.hasil_ekstraksi ?? null,
    },
  };
}
