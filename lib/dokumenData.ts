import { createServiceClient } from "@/lib/supabase/server";
import { terbilang, formatRupiah } from "@/lib/terbilang";
import { formatTanggalSurat, formatHariTanggal } from "@/lib/format";

export type DokumenData = Awaited<ReturnType<typeof buildDokumenData>>;

export async function buildDokumenData(pengajuanId: string) {
  // Pakai service_role di server -- tidak terikat sesi/cookie user, aman dipanggil dari route/page manapun.
  const supabase = createServiceClient();

  // Nama SKPD -- SATU sumber kebenaran untuk ketiga dokumen (Nota Dinas,
  // SPP/SPTJB, Kwitansi GU), dibaca dari menu Pengaturan Aplikasi supaya
  // bisa diubah langsung dari aplikasi (edit/simpan) tanpa perlu ubah
  // environment variable atau redeploy. Kalau baris pengaturannya belum
  // ada (mis. migrasi belum dijalankan), pakai default di bawah supaya
  // dokumen tetap bisa dibuat.
  const { data: pengaturan } = await supabase
    .from("pengaturan_aplikasi")
    .select("nama_skpd_baris1, nama_skpd_baris2")
    .eq("id", 1)
    .maybeSingle();
  const baris1 = pengaturan?.nama_skpd_baris1 || "Bagian Perekonomian dan Sumber Daya Alam";
  const baris2 = pengaturan?.nama_skpd_baris2 || "Sekretariat Daerah Kota Batu";
  const NAMA_SKPD_SATU_BARIS = `${baris1} ${baris2}`;
  const NAMA_SKPD_DUA_BARIS = `${baris1}\n${baris2}`;

  const { data: pengajuan, error } = await supabase
    .from("pengajuan_belanja")
    .select(
      `
      id, dpa_id, nomor_bukti, nomor_nota_dinas, metode_pembayaran, tanggal, uraian_kegiatan, jumlah_pengajuan, nama_penerima,
      penyedia:penyedia(nama_penyedia, nama_direktur, alamat, npwp, rekening_bank),
      dpa:dpa (
        tahun_anggaran, tahapan, pagu_anggaran, nomor_dpa,
        pptk:pejabat_skpd(nama, nip, pangkat, nomor_sk),
        rekening:rekening_belanja (
          kode_rekening, jenis_belanja, kelompok_belanja, sumber_dana,
          sub_kegiatan:sub_kegiatan (
            kode_sub_kegiatan, nama_sub_kegiatan,
            kegiatan:kegiatan (
              kode_kegiatan, nama_kegiatan,
              program:program ( kode_program, nama_program )
            )
          )
        )
      )
    `
    )
    .eq("id", pengajuanId)
    .single();

  if (error || !pengajuan) {
    throw new Error(error?.message || "Pengajuan tidak ditemukan.");
  }

  const { data: rincianRows } = await supabase
    .from("rincian_belanja")
    .select("*")
    .eq("pengajuan_id", pengajuanId);

  const { data: potonganRows } = await supabase
    .from("potongan_pajak")
    .select("*")
    .eq("pengajuan_id", pengajuanId);

  // Realisasi sebelum pengajuan ini -- jumlah pengajuan lain yang sudah
  // "disetujui"/"dicairkan" di rekening (DPA) yang sama, supaya sisa
  // anggaran yang tercetak di dokumen konsisten dengan Rekap Realisasi.
  const dpaIdForRealisasi = (pengajuan as any).dpa_id;
  const { data: realisasiLainRows } = await supabase
    .from("pengajuan_belanja")
    .select("jumlah_pengajuan")
    .eq("dpa_id", dpaIdForRealisasi)
    .in("status", ["disetujui", "dicairkan"])
    .neq("id", pengajuanId);
  const realisasiSebelum = (realisasiLainRows ?? []).reduce(
    (s: number, r: any) => s + Number(r.jumlah_pengajuan || 0),
    0
  );

  const tahunAnggaran: number = (pengajuan as any).dpa?.tahun_anggaran ?? new Date().getFullYear();
  const { data: kpaRow } = await supabase
    .from("pejabat_skpd")
    .select("nama, nip, pangkat")
    .eq("jabatan", "KPA")
    .eq("tahun_anggaran", tahunAnggaran)
    .maybeSingle();
  const { data: bppRow } = await supabase
    .from("pejabat_skpd")
    .select("nama, nip, pangkat")
    .eq("jabatan", "BENDAHARA_PENGELUARAN_PEMBANTU")
    .eq("tahun_anggaran", tahunAnggaran)
    .maybeSingle();

  const dpa: any = (pengajuan as any).dpa;
  const rekening = dpa?.rekening;
  const subKeg = rekening?.sub_kegiatan;
  const kegiatan = subKeg?.kegiatan;
  const program = kegiatan?.program;
  const pptk = dpa?.pptk;

  // kode_rekening yang tersimpan di database SUDAH LENGKAP (sudah termasuk
  // prefix kode sub kegiatan di depannya, persis format kolom KODE_REKENING
  // di file lampiran DPA) -- jangan digabung lagi dengan kode_sub_kegiatan,
  // nanti dobel (bug yang sempat terjadi: "4.01.01.2.06.0002.4.01.01.2.06.0002...").
  const kodeRekeningLengkap = rekening?.kode_rekening || "";

  const rincian = (rincianRows ?? []).map((r: any) => ({
    nama_item: r.nama_item,
    qty: r.qty,
    satuan: r.satuan,
    harga_satuan: formatRupiah(r.harga_satuan),
    subtotal: formatRupiah(r.subtotal),
    // dipakai di loop rincian Nota Dinas
    jenis_belanja: rekening?.jenis_belanja,
    uraian_kegiatan: r.nama_item,
    jumlah_pengajuan: formatRupiah(r.subtotal),
  }));

  // Potongan pajak -- daftar DINAMIS (bukan 4 slot tetap seperti versi
  // lama), supaya selalu konsisten dengan apapun yang dihasilkan
  // kalkulator pajak di form Pengajuan Belanja (PPN, PPh 22/23, PPh
  // Final UMKM, Pajak Daerah, atau potongan manual dengan label bebas).
  const potongan = (potonganRows ?? []).map((p: any) => ({
    jenis_pajak: p.jenis_pajak,
    nominal: formatRupiah(p.nominal),
  }));
  const totalPotongan = (potonganRows ?? []).reduce((s: number, p: any) => s + Number(p.nominal || 0), 0);
  const jumlahDiterima = Number(pengajuan.jumlah_pengajuan) - totalPotongan;

  return {
    nama_skpd: NAMA_SKPD_SATU_BARIS,
    nama_skpd_2baris: NAMA_SKPD_DUA_BARIS,
    tahun_anggaran: tahunAnggaran,
    tahapan_dpa: dpa?.tahapan,
    kode_rekening: rekening?.kode_rekening,
    kode_rekening_lengkap: kodeRekeningLengkap,
    kelompok_belanja: rekening?.kelompok_belanja || "",
    jenis_belanja: rekening?.jenis_belanja,
    sumber_dana: rekening?.sumber_dana,
    kode_sub_kegiatan: subKeg?.kode_sub_kegiatan,
    sub_kegiatan_nama: subKeg?.nama_sub_kegiatan,
    nama_sub_kegiatan: subKeg?.nama_sub_kegiatan,
    kegiatan_nama: kegiatan?.nama_kegiatan,
    nama_kegiatan: kegiatan?.nama_kegiatan,
    program_nama: program?.nama_program,
    pagu_anggaran: formatRupiah(dpa?.pagu_anggaran || 0),
    uraian_kegiatan: pengajuan.uraian_kegiatan,
    uraian_kegiatan_lengkap: pengajuan.uraian_kegiatan,
    jumlah_pengajuan: formatRupiah(pengajuan.jumlah_pengajuan),
    total_pengajuan: formatRupiah(pengajuan.jumlah_pengajuan),
    realisasi_sebelum: formatRupiah(realisasiSebelum),
    sisa_anggaran: formatRupiah((dpa?.pagu_anggaran || 0) - realisasiSebelum - Number(pengajuan.jumlah_pengajuan)),
    nomor_nota_dinas: pengajuan.nomor_nota_dinas || "-",
    nomor_bukti: pengajuan.nomor_bukti || "-",
    hari_tanggal: formatHariTanggal(pengajuan.tanggal),
    tanggal_surat: formatTanggalSurat(pengajuan.tanggal),
    tanggal: pengajuan.tanggal,
    jenis_pencairan: (pengajuan as any).metode_pembayaran || "GU",
    metode_pembayaran: (pengajuan as any).metode_pembayaran || "GU",

    nama_pptk: pptk?.nama || "-",
    pangkat_pptk: pptk?.pangkat || "",
    nip_pptk: pptk?.nip || "-",
    nomor_sk_kpa: pptk?.nomor_sk || "-",

    nama_kpa: kpaRow?.nama || "-",
    pangkat_kpa: kpaRow?.pangkat || "",
    nip_kpa: kpaRow?.nip || "-",
    nama_bendahara: bppRow?.nama || "-",
    pangkat_bendahara: bppRow?.pangkat || "",
    nip_bendahara: bppRow?.nip || "-",

    nama_penerima: (pengajuan as any).nama_penerima || "-",
    nama_penyedia: (pengajuan as any).penyedia?.nama_penyedia || "",

    jumlah_pengajuan_angka: formatRupiah(pengajuan.jumlah_pengajuan),
    jumlah_pengajuan_terbilang: terbilang(Number(pengajuan.jumlah_pengajuan)),
    jumlah_uang: formatRupiah(pengajuan.jumlah_pengajuan),
    jumlah_uang_terbilang: terbilang(Number(pengajuan.jumlah_pengajuan)),

    potongan,
    total_potongan: formatRupiah(totalPotongan),
    jumlah_diterima: formatRupiah(jumlahDiterima),

    rincian,
  };
}
