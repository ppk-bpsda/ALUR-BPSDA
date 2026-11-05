import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { formatTanggalSurat, formatHariTanggal } from "@/lib/format";
import { renderTemplate } from "@/lib/renderTemplate";
import { formatRentang } from "./kuitansi";

/**
 * Surat Tugas (BERKOP) & Laporan Perjalanan Dinas (TANPA kop) dibuat dari
 * SATU sumber data yang sama dengan Kuitansi SPPD (tabel perjadin).
 * Format mengikuti tata naskah dinas pemerintah daerah: huruf Arial,
 * Surat Tugas = kop surat + dasar + memerintahkan + untuk + penandatangan;
 * Laporan = pendahuluan, waktu/tempat, pelaksana, hasil, penutup (tanpa kop).
 */

const TEMPAT = "Batu";
const HARI_TERBILANG = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas", "dua belas", "tiga belas", "empat belas", "lima belas"];
const terbilangHari = (n: number) => HARI_TERBILANG[n] ?? String(n);

// "Menghadiri ..." -> "menghadiri ..." (kecuali singkatan/nama diri: huruf kedua kapital)
const awalKecil = (s: string) => String(s || "").trim().replace(/^(\p{Lu})(?=\p{Ll})/u, (m) => m.toLowerCase());
const akhiriTitik = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : s.trim() + ".");
const baris = (s: unknown) => String(s ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

async function muat(perjadinId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Sesi berakhir. Silakan login kembali.");
  const supabase = createServiceClient();

  const { data: pj, error } = await supabase
    .from("perjadin")
    .select(
      `*, peserta:perjadin_peserta(nama, nip, pangkat_gol, jabatan, urut),
       dpa:dpa(tahun_anggaran, tahapan,
         rekening:rekening_belanja(kode_rekening, jenis_belanja,
           sub_kegiatan:sub_kegiatan(nama_sub_kegiatan, kegiatan:kegiatan(nama_kegiatan))))`
    )
    .eq("id", perjadinId)
    .single();
  if (error || !pj) throw new Error(error?.message || "Data perjalanan dinas tidak ditemukan.");
  if (!pj.peserta?.length) throw new Error("Belum ada peserta perjalanan dinas.");

  const { data: pengaturan } = await supabase
    .from("pengaturan_aplikasi").select("nama_skpd_baris1, nama_skpd_baris2").eq("id", 1).maybeSingle();
  const skpd1 = pengaturan?.nama_skpd_baris1 || "Bagian Perekonomian dan Sumber Daya Alam";
  const skpd2 = pengaturan?.nama_skpd_baris2 || "Sekretariat Daerah Kota Batu";

  // Penandatangan = Kepala SKPD (KPA) tahun anggaran terkait.
  const { data: kpaRows } = await supabase
    .from("pejabat_skpd").select("nama, nip, pangkat")
    .eq("jabatan", "KPA").eq("tahun_anggaran", pj.tahun_anggaran)
    .order("aktif", { ascending: false })
    .order("tanggal_sk", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false }).limit(1);
  const kpa = (kpaRows ?? [])[0] ?? null;

  const peserta = [...pj.peserta].sort((a: any, b: any) => a.urut - b.urut);
  return { pj, peserta, skpd1, skpd2, kpa };
}

function umum(m: Awaited<ReturnType<typeof muat>>) {
  const { pj, peserta, skpd1, skpd2, kpa } = m;
  const rek: any = (pj.dpa as any)?.rekening;
  const sub = rek?.sub_kegiatan;
  const tujuan = [pj.tujuan_kota, pj.tujuan_provinsi].filter(Boolean).join(", ") || "-";
  const hari = Number(pj.lama_hari);
  const awal = formatHariTanggal(pj.tanggal_berangkat).split(",")[0];
  const akhir = formatHariTanggal(pj.tanggal_kembali).split(",")[0];
  return {
    tahun_anggaran: pj.tahun_anggaran,
    nama_skpd_besar: `${skpd1} ${skpd2}`.toUpperCase(),
    nomor_surat_tugas: pj.nomor_surat_tugas || "-",
    tanggal_surat_tugas: pj.tanggal_surat_tugas ? formatTanggalSurat(pj.tanggal_surat_tugas) : "-",
    maksud: String(pj.maksud || "").trim().replace(/[.\s]+$/, ""),
    maksud_kalimat: awalKecil(pj.maksud).replace(/[.\s]+$/, ""),
    tujuan,
    lama_hari: hari,
    lama_hari_terbilang: terbilangHari(hari),
    tanggal_pelaksanaan: formatRentang(pj.tanggal_berangkat, pj.tanggal_kembali),
    hari_tanggal: pj.tanggal_berangkat === pj.tanggal_kembali
      ? formatHariTanggal(pj.tanggal_berangkat)
      : `${awal} s/d ${akhir}, ${formatRentang(pj.tanggal_berangkat, pj.tanggal_kembali)}`,
    sub_kegiatan: sub?.nama_sub_kegiatan || "-",
    beban_anggaran: rek
      ? `${rek.jenis_belanja} (${rek.kode_rekening}) — Sub Kegiatan ${sub?.nama_sub_kegiatan || "-"}, DPA ${skpd1} ${skpd2} Tahun Anggaran ${pj.tahun_anggaran}`
      : "-",
    tempat: TEMPAT,
    jabatan_penandatangan: `Kepala ${skpd1}`,
    nama_penandatangan: kpa?.nama || "-",
    nip_penandatangan: kpa?.nip || "-",
    pangkat_penandatangan: kpa?.pangkat || "",
    peserta: peserta.map((p: any, i: number) => ({
      no: i + 1, nama: p.nama, nip: p.nip || "-", pangkat: p.pangkat_gol || "-", jabatan: p.jabatan || "-",
    })),
    _skpd: `${skpd1} ${skpd2}`,
  };
}

export async function buildSuratTugas(perjadinId: string): Promise<{ buffer: Buffer; filename: string }> {
  const m = await muat(perjadinId);
  const { pj } = m;
  const u = umum(m);

  // Dasar: isian pengguna (satu baris = satu butir); bila kosong, dasar yang pasti benar menurut data.
  const dasarUser = baris((pj as any).dasar_penugasan);
  const dasar = dasarUser.length
    ? dasarUser
    : [`Dokumen Pelaksanaan Anggaran (DPA) ${u._skpd} Tahun Anggaran ${pj.tahun_anggaran} pada Sub Kegiatan ${u.sub_kegiatan}.`];

  const untuk = [
    `${akhiriTitik((u.maksud_kalimat.charAt(0).toUpperCase() + u.maksud_kalimat.slice(1)) + (u.tujuan !== "-" ? ` di ${u.tujuan}` : ""))}`,
    `Perjalanan dinas dilaksanakan selama ${u.lama_hari} (${u.lama_hari_terbilang}) hari, pada ${u.hari_tanggal}.`,
    `Biaya perjalanan dinas dibebankan pada ${u.beban_anggaran}.`,
    "Melaporkan hasil pelaksanaan tugas secara tertulis kepada pemberi tugas setelah perjalanan dinas selesai.",
  ];

  const tanggal = pj.tanggal_surat_tugas || pj.tanggal_berangkat;
  const buffer = renderTemplate("Template_Surat_Tugas.docx", {
    ...u,
    tanggal_surat: formatTanggalSurat(tanggal),
    dasar: dasar.map((isi, i) => ({ no: i + 1, isi })),
    untuk: untuk.map((isi, i) => ({ no: i + 1, isi })),
  });
  const aman = (pj.nomor_surat_tugas || pj.id).toString().replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 40);
  return { buffer, filename: `Surat_Tugas_${aman}.docx` };
}

export async function buildLaporanPerjadin(perjadinId: string): Promise<{ buffer: Buffer; filename: string }> {
  const m = await muat(perjadinId);
  const { pj } = m;
  const u = umum(m);

  const pendahuluan =
    `Sesuai Surat Tugas Nomor ${u.nomor_surat_tugas} tanggal ${u.tanggal_surat_tugas}, kami telah melaksanakan perjalanan dinas ` +
    `${u.tujuan !== "-" ? `ke ${u.tujuan} ` : ""}selama ${u.lama_hari} (${u.lama_hari_terbilang}) hari.`;

  const hasilUser = String((pj as any).hasil_kegiatan ?? "").trim();
  const hasil = hasilUser ||
    `Kegiatan ${u.maksud_kalimat} telah dilaksanakan pada ${u.tanggal_pelaksanaan}${u.tujuan !== "-" ? ` di ${u.tujuan}` : ""} dan seluruh pelaksana mengikuti rangkaian kegiatan dengan baik.`;

  const buffer = renderTemplate("Template_Laporan_Perjadin.docx", {
    ...u,
    pendahuluan,
    hasil_kegiatan: hasil,
    pelaksana_ringkas: u.peserta.length === 1 ? u.peserta[0].nama : `${u.peserta[0].nama} dan ${u.peserta.length - 1} pelaksana lainnya`,
    tanggal_laporan: formatTanggalSurat(pj.tanggal_kuitansi || pj.tanggal_kembali),
  });
  const aman = (pj.nomor_surat_tugas || pj.id).toString().replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 40);
  return { buffer, filename: `Laporan_Perjalanan_Dinas_${aman}.docx` };
}
