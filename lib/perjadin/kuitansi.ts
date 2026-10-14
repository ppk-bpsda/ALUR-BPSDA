import PizZip from "pizzip";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { terbilang, formatRupiah } from "@/lib/terbilang";
import { formatTanggalSurat, kodeRekeningBelanja } from "@/lib/format";
import { renderTemplate } from "@/lib/renderTemplate";

export type BiayaLain = { uraian: string; jumlah: number };

const TERBILANG_HARI = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
function terbilangHari(n: number) {
  return n >= 0 && n <= 11 ? TERBILANG_HARI[n] : terbilang(n).replace(/ Rupiah$/, "").toLowerCase();
}

export function formatRentang(mulai: string, selesai: string) {
  if (mulai === selesai) return formatTanggalSurat(mulai);
  const [y1, m1] = mulai.split("-"), [y2, m2] = selesai.split("-");
  const a = formatTanggalSurat(mulai), b = formatTanggalSurat(selesai);
  if (y1 === y2 && m1 === m2) return `${Number(mulai.split("-")[2])} s/d ${b}`;
  return `${a} s/d ${b}`;
}

/** Hitung total per peserta (dipakai kuitansi & tampilan daftar). */
export function totalPerPeserta(tarif: number, hari: number, lain: BiayaLain[]) {
  return Math.round(tarif) * hari + lain.reduce((s, b) => s + Math.round(Number(b.jumlah) || 0), 0);
}

export async function buildKuitansiSppd(perjadinId: string, opts: { hitam?: boolean } = {}): Promise<{ buffer: Buffer; filename: string }> {
  // Memakai service_role -> wajib login (sama seperti buildDokumenData).
  const user = await getSessionUser();
  if (!user) throw new Error("Sesi berakhir. Silakan login kembali.");
  const supabase = createServiceClient();

  const { data: pj, error } = await supabase
    .from("perjadin")
    .select(
      `*, peserta:perjadin_peserta(nama, nip, pangkat_gol, jabatan, urut),
       dpa:dpa(tahun_anggaran, tahapan,
         pptk:pejabat_skpd(nama, nip),
         rekening:rekening_belanja(kode_rekening, jenis_belanja,
           sub_kegiatan:sub_kegiatan(kode_sub_kegiatan, nama_sub_kegiatan,
             kegiatan:kegiatan(nama_kegiatan, program:program(nama_program)))))`
    )
    .eq("id", perjadinId)
    .single();
  if (error || !pj) throw new Error(error?.message || "Data perjalanan dinas tidak ditemukan.");
  if (!pj.peserta?.length) throw new Error("Belum ada peserta perjalanan dinas.");

  const { data: pengaturan } = await supabase
    .from("pengaturan_aplikasi").select("nama_skpd_baris1, nama_skpd_baris2").eq("id", 1).maybeSingle();
  const skpd = `${pengaturan?.nama_skpd_baris1 || "Bagian Perekonomian dan Sumber Daya Alam"}\n${pengaturan?.nama_skpd_baris2 || "Sekretariat Daerah Kota Batu"}`;

  const ambilPejabat = async (jabatan: "KPA" | "BENDAHARA_PENGELUARAN_PEMBANTU") => {
    const { data } = await supabase
      .from("pejabat_skpd").select("nama, nip")
      .eq("jabatan", jabatan).eq("tahun_anggaran", pj.tahun_anggaran)
      .order("aktif", { ascending: false })
      .order("tanggal_sk", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false }).limit(1);
    return (data ?? [])[0] ?? null;
  };
  const [kpa, bpp] = await Promise.all([ambilPejabat("KPA"), ambilPejabat("BENDAHARA_PENGELUARAN_PEMBANTU")]);

  const dpa: any = pj.dpa;
  const rek = dpa?.rekening;
  const subKeg = rek?.sub_kegiatan;
  const kodeLengkap = rek?.kode_rekening || "-";

  const tarif = Number(pj.tarif_uang_harian || 0);
  const hari = Number(pj.lama_hari);
  const lain: BiayaLain[] = Array.isArray(pj.biaya_lain) ? pj.biaya_lain : [];
  const jenisLabel = pj.jenis_tarif === "rapat" ? "Uang harian rapat" : pj.jenis_tarif === "diklat" ? "Uang harian diklat" : "Uang harian";
  const tujuan = [pj.tujuan_kota, pj.tujuan_provinsi].filter(Boolean).join(", ") || "-";
  const tglKuitansi = pj.tanggal_kuitansi || pj.tanggal_kembali;
  const peserta = [...pj.peserta].sort((a: any, b: any) => a.urut - b.urut);

  const shared = {
    tahun_anggaran: pj.tahun_anggaran,
    nama_skpd: skpd.replace("\n", " "),
    nama_skpd_2baris: skpd,
    maksud: pj.maksud,
    nomor_surat_tugas: pj.nomor_surat_tugas || "-",
    tanggal_surat_tugas: pj.tanggal_surat_tugas ? formatTanggalSurat(pj.tanggal_surat_tugas) : "-",
    tujuan,
    lama_hari: hari,
    lama_hari_terbilang: terbilangHari(hari),
    tanggal_pelaksanaan: formatRentang(pj.tanggal_berangkat, pj.tanggal_kembali),
    program: subKeg?.kegiatan?.program?.nama_program || "-",
    kegiatan: subKeg?.kegiatan?.nama_kegiatan || "-",
    sub_kegiatan: subKeg?.nama_sub_kegiatan || "-",
    jenis_belanja: rek?.jenis_belanja || "-",
    kode_rekening_lengkap: kodeLengkap,
    kode_rekening_belanja: kodeRekeningBelanja(kodeLengkap),
    tanggal_kuitansi: formatTanggalSurat(tglKuitansi),
    nama_kpa: kpa?.nama || "-", nip_kpa: kpa?.nip || "-",
    nama_pptk: dpa?.pptk?.nama || "-", nip_pptk: dpa?.pptk?.nip || "-",
    nama_bendahara: bpp?.nama || "-", nip_bendahara: bpp?.nip || "-",
  };

  const total = totalPerPeserta(tarif, hari, lain);
  // Maksud ditempatkan di tengah kalimat ("... untuk {maksud}") -> huruf awal kecil,
  // kecuali singkatan/nama diri (huruf kedua kapital/angka).
  const maksudKalimat = String(pj.maksud || "").replace(/^(\p{Lu})(?=\p{Ll})/u, (m: string) => m.toLowerCase());
  const data = {
    peserta: peserta.map((p: any, i: number) => {
      // Mengikuti pola baris Template Kwitansi GU: "- {nama_item} {qty} {satuan} x {harga_satuan} = {subtotal}"
      const rincian = [
        { nama_item: jenisLabel, qty: hari, satuan: "hari", harga_satuan: formatRupiah(tarif), subtotal: formatRupiah(tarif * hari) },
        ...lain.map((b) => ({ nama_item: b.uraian, qty: 1, satuan: "paket", harga_satuan: formatRupiah(Number(b.jumlah) || 0), subtotal: formatRupiah(Number(b.jumlah) || 0) })),
      ];
      const nomor = pj.nomor_kuitansi ? (peserta.length > 1 ? `${pj.nomor_kuitansi}/${i + 1}` : pj.nomor_kuitansi) : "-";
      return {
        ...shared,
        maksud: maksudKalimat,
        nomor_bukti: nomor,
        nomor_kuitansi: nomor,
        nama_pegawai: p.nama, nip_pegawai: p.nip || "-",
        pangkat_pegawai: p.pangkat_gol || "-", jabatan_pegawai: p.jabatan || "-",
        rincian,
        jumlah_uang: formatRupiah(total),
        jumlah_uang_terbilang: terbilang(total),
        jumlah_terbilang: terbilang(total),
        // Blok "Potongan" pada format kuitansi dipertahankan; perjalanan dinas tidak
        // memiliki potongan pajak otomatis -> Rp 0 (dapat diubah langsung di Word).
        potongan_pajak_daerah: "0", potongan_pph_final: "0", potongan_pph22: "0", potongan_pph23: "0",
        total_potongan: "0",
        jumlah_diterima: formatRupiah(total),
        tanggal_surat: shared.tanggal_kuitansi,
        nama_penerima: p.nama,
        terakhir: i === peserta.length - 1,
      };
    }),
  };

  let buffer = renderTemplate("Template_Kuitansi_SPPD.docx", data);
  if (opts.hitam) {
    // Versi siap cetak: hilangkan warna merah penanda isian otomatis.
    const zip = new PizZip(buffer);
    const f = zip.file("word/document.xml")!;
    zip.file("word/document.xml", f.asText().replace(/<w:color w:val="FF0000"\/>/g, ""));
    buffer = zip.generate({ type: "nodebuffer" });
  }
  const aman = (pj.nomor_surat_tugas || pj.id).toString().replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 40);
  return { buffer, filename: `Kuitansi_SPPD_${aman}${opts.hitam ? "_cetak" : ""}.docx` };
}
