import { createServiceClient } from "@/lib/supabase/server";
import { terbilang, formatRupiah } from "@/lib/terbilang";
import { formatTanggalSurat, formatHariTanggal, kodeRekeningBelanja } from "@/lib/format";

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
      id, dpa_id, nomor_bukti, nomor_nota_dinas, metode_pembayaran, tanggal, created_at, uraian_kegiatan, jumlah_pengajuan, nama_penerima,
      penyedia:penyedia(nama_penyedia, nama_direktur, alamat, npwp, rekening_bank),
      dpa:dpa (
        rekening_id, tahun_anggaran, tahapan, pagu_anggaran, nomor_dpa,
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

  // Pagu & Realisasi Sblm pada Nota Dinas -- sesuai contoh perhitungan
  // (perhitungan_dalam_Nota_Dinas.xlsx) kolom Bulan/Pagu/Realisasi
  // Sblm/Ajuan Skrg/Sisa:
  //   - Pagu SETIAP Nota Dinas = pagu DPA tahapan yang berlaku SAAT ITU
  //     (dpa.pagu_anggaran), diambil LANGSUNG -- BUKAN dirantai dari
  //     "Sisa" Nota Dinas sebelumnya. Pagu hanya berubah kalau tahapan
  //     DPA-nya berubah (Murni -> Pergeseran -> Perubahan), dan tetap
  //     SAMA selama masih dalam tahapan yang sama, walau sudah dipakai
  //     berkali-kali (lihat kolom B di file contoh: 32.429.052 berulang
  //     di 3 baris sebelum berubah jadi 32.100.000 saat tahapan berganti).
  //   - Realisasi Sblm = akumulasi (SUM) seluruh Ajuan Skrg dari SEMUA
  //     Nota Dinas sebelumnya (disetujui/dicairkan) untuk REKENING yang
  //     sama, LINTAS tahapan DPA (bukan cuma dpa_id yang sama) --
  //     akumulasi ini TIDAK di-reset saat tahapan/pagu berganti (lihat
  //     kolom C: terus bertambah dari bulan ke bulan meski Pagu di
  //     kolom B berubah).
  //   - Sisa = Pagu - Realisasi Sblm - Ajuan Skrg.
  const rekeningIdForRealisasi = (pengajuan as any).dpa?.rekening_id;
  const tahunAnggaranForRealisasi = (pengajuan as any).dpa?.tahun_anggaran;
  const tanggalDokumenIni = (pengajuan as any).tanggal;
  const createdAtDokumenIni = (pengajuan as any).created_at;

  const { data: riwayatRows } = await supabase
    .from("pengajuan_belanja")
    .select("jumlah_pengajuan, tanggal, created_at, dpa!inner(rekening_id, tahun_anggaran)")
    .eq("dpa.rekening_id", rekeningIdForRealisasi)
    .eq("dpa.tahun_anggaran", tahunAnggaranForRealisasi)
    .in("status", ["disetujui", "dicairkan"])
    .neq("id", pengajuanId);

  // Hanya hitung baris yang benar-benar terjadi SEBELUM dokumen ini
  // (tanggal lebih awal, atau tanggal sama tapi created_at lebih awal --
  // supaya urutan tetap konsisten kalau ada beberapa Nota Dinas di
  // tanggal yang sama).
  const realisasiSebelum = (riwayatRows ?? [])
    .filter((row: any) => {
      if (row.tanggal < tanggalDokumenIni) return true;
      if (row.tanggal > tanggalDokumenIni) return false;
      return row.created_at < createdAtDokumenIni;
    })
    .reduce((sum: number, row: any) => sum + Number(row.jumlah_pengajuan || 0), 0);

  // Pagu dokumen ini = pagu DPA tahapan berjalan, langsung (tidak dirantai).
  const paguDokumen = Number((pengajuan as any).dpa?.pagu_anggaran || 0);

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
    belanja: rekening?.jenis_belanja, // alias -- dipakai di template sesuai lampiran contoh
    uraian_kegiatan: r.nama_item,
    // PENTING: field ini SENGAJA dibuat terpisah dari `uraian_kegiatan` di
    // atas. Di dalam loop {#rincian} docxtemplater, key `uraian_kegiatan`
    // pada tiap baris MENIMPA (shadow) `uraian_kegiatan` di level atas
    // (uraian aktivitas lengkap dari form Pengajuan Belanja) dengan nama
    // item rincian saja (mis. "Kue Kotak") -- itu sebabnya baris "Belanja"
    // di tabel Nota Dinas sempat salah menampilkan nama item, bukan uraian
    // kegiatan lengkap. Template Nota Dinas HARUS pakai tag ini, bukan
    // {uraian_kegiatan}, di baris "Belanja {jenis_belanja} {...}".
    uraian_kegiatan_lengkap: pengajuan.uraian_kegiatan,
    rincian_belanja: r.nama_item, // alias -- dipakai di template sesuai lampiran contoh
    jumlah_pengajuan: formatRupiah(r.subtotal),
    realisasi: formatRupiah(r.subtotal), // alias -- kolom "Ajuan Skrg" per baris rincian
  }));

  // Potongan pajak -- SLOT TETAP sesuai format baku Kwitansi GU (lampiran
  // fisik): PPN, Pajak Daerah 10%, PPh 21 0,5%, PPh 21 2,5%, PPh 22 1,5%,
  // PPh 23 2%. SEMUA baris SELALU dicetak, diisi Rp 0 kalau jenis pajak
  // itu tidak relevan untuk paket belanja/nominal realisasi pengajuan ini
  // -- bukan disembunyikan/dihilangkan seperti versi daftar dinamis
  // sebelumnya. Dicocokkan ke hasil kalkulator pajak (potongan_pajak) lewat
  // PERSENTASE (bukan teks label, supaya tidak meleset kalau labelnya
  // sedikit berbeda -- mis. "PPh Final UMKM 0,5%" tetap masuk slot
  // "PPh 21 0,5%" karena sama-sama tarif 0,5%). Kalau ada baris potongan
  // dengan tarif di luar 6 slot ini (mis. PPh 22/23 tanpa NPWP, PPh 21
  // Bukan Pegawai 5%/6%, dsb), TIDAK hilang -- ditampilkan di daftar
  // tambahan `potongan_lainnya` di bawah 6 baris tetap tsb.
  const sudahDipetakan = new Set<number>();
  const jumlahByPersentase = (target: number, toleransi = 0.01) => {
    let total = 0;
    (potonganRows ?? []).forEach((p: any, idx: number) => {
      if (sudahDipetakan.has(idx)) return;
      const pct = Number(p.persentase ?? 0);
      if (Math.abs(pct - target) <= toleransi) {
        total += Number(p.nominal || 0);
        sudahDipetakan.add(idx);
      }
    });
    return total;
  };
  const potongan_ppn = jumlahByPersentase(11) + jumlahByPersentase(12);
  const potongan_pajak_daerah = jumlahByPersentase(10);
  const potongan_pph21_05 = jumlahByPersentase(0.5);
  const potongan_pph21_25 = jumlahByPersentase(2.5);
  const potongan_pph22_15 = jumlahByPersentase(1.5);
  const potongan_pph23_2 = jumlahByPersentase(2);
  const potongan_lainnya = (potonganRows ?? [])
    .filter((_: any, idx: number) => !sudahDipetakan.has(idx))
    .map((p: any) => ({
      jenis_pajak: p.tipe === "tambahan" ? `${p.jenis_pajak} (tambahan)` : p.jenis_pajak,
      nominal: formatRupiah(p.nominal),
    }));
  // `jumlah_pengajuan` sudah mencakup potongan bertipe 'tambahan' (PPN
  // atas harga netto -- lihat perhitungan di app/api/pengajuan/route.ts
  // & [id]/route.ts), jadi di sini HANYA potongan yang MENGURANGI
  // penerimaan penyedia (tipe 'potongan', termasuk baris lama yang
  // belum diisi `tipe` / null) yang dikurangkan lagi.
  const totalPotongan = (potonganRows ?? [])
    .filter((p: any) => p.tipe !== "tambahan")
    .reduce((s: number, p: any) => s + Number(p.nominal || 0), 0);
  const jumlahDiterima = Number(pengajuan.jumlah_pengajuan) - totalPotongan;

  return {
    nama_skpd: NAMA_SKPD_SATU_BARIS,
    nama_skpd_2baris: NAMA_SKPD_DUA_BARIS,
    skpd: NAMA_SKPD_SATU_BARIS, // alias -- dipakai di template sesuai lampiran contoh
    tahun_anggaran: tahunAnggaran,
    tahapan_dpa: dpa?.tahapan,
    program: program?.nama_program, // alias program_nama
    kegiatan: kegiatan?.nama_kegiatan, // alias nama_kegiatan/kegiatan_nama
    sub_kegiatan: subKeg?.nama_sub_kegiatan, // alias nama_sub_kegiatan/sub_kegiatan_nama
    // Kolom "Kode Rek." pada baris Belanja di Nota Dinas: SELALU kode
    // rekening belanja saja (19 karakter terakhir), bukan kode lengkap --
    // otomatis diturunkan dari kode_rekening_belanja / kode_rekening_lengkap
    // memakai kodeRekeningBelanja(), bukan disimpan manual.
    kode_rekening: kodeRekeningBelanja(kodeRekeningLengkap),
    kode_rekening_kegiatan: subKeg?.kode_sub_kegiatan, // alias kode_sub_kegiatan -- kode di baris tingkat Kegiatan/Sub Kegiatan
    kode_rekening_lengkap: kodeRekeningLengkap,
    // 19 karakter terakhir dari kode rekening lengkap -- dipakai kalau dokumen/isian
    // butuh "Kode Rekening Belanja" saja tanpa prefix kode sub kegiatan.
    kode_rekening_belanja: kodeRekeningBelanja(kodeRekeningLengkap),
    kelompok_belanja: rekening?.kelompok_belanja || "",
    jenis_belanja: rekening?.jenis_belanja,
    belanja: rekening?.jenis_belanja, // alias -- dipakai di template sesuai lampiran contoh
    sumber_dana: rekening?.sumber_dana,
    kode_sub_kegiatan: subKeg?.kode_sub_kegiatan,
    sub_kegiatan_nama: subKeg?.nama_sub_kegiatan,
    nama_sub_kegiatan: subKeg?.nama_sub_kegiatan,
    kegiatan_nama: kegiatan?.nama_kegiatan,
    nama_kegiatan: kegiatan?.nama_kegiatan,
    program_nama: program?.nama_program,
    pagu: formatRupiah(paguDokumen), // alias pagu_anggaran
    pagu_anggaran: formatRupiah(paguDokumen),
    uraian_kegiatan: pengajuan.uraian_kegiatan,
    uraian_kegiatan_lengkap: pengajuan.uraian_kegiatan,
    uraian_belanja: pengajuan.uraian_kegiatan, // alias -- dipakai di template SPTJB sesuai lampiran contoh
    jumlah_pengajuan: formatRupiah(pengajuan.jumlah_pengajuan),
    total_pengajuan: formatRupiah(pengajuan.jumlah_pengajuan),
    realisasi: formatRupiah(pengajuan.jumlah_pengajuan), // alias -- kolom "Ajuan Skrg" di lampiran contoh
    realisasi_sebelum: formatRupiah(realisasiSebelum),
    sisa_pagu: formatRupiah(paguDokumen - realisasiSebelum - Number(pengajuan.jumlah_pengajuan)), // alias sisa_anggaran -- Sisa = Pagu - Realisasi Sblm - Ajuan Skrg
    sisa_anggaran: formatRupiah(paguDokumen - realisasiSebelum - Number(pengajuan.jumlah_pengajuan)),
    nomor_nota_dinas: pengajuan.nomor_nota_dinas || "-",
    nomor_bukti: pengajuan.nomor_bukti || "-",
    hari_tanggal: formatHariTanggal(pengajuan.tanggal),
    tanggal_surat: formatTanggalSurat(pengajuan.tanggal),
    tanggal_spp: formatTanggalSurat(pengajuan.tanggal), // alias -- dipakai di template SPTJB sesuai lampiran contoh
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

    potongan_ppn: formatRupiah(potongan_ppn),
    potongan_pajak_daerah: formatRupiah(potongan_pajak_daerah),
    potongan_pph21_05: formatRupiah(potongan_pph21_05),
    potongan_pph21_25: formatRupiah(potongan_pph21_25),
    potongan_pph22_15: formatRupiah(potongan_pph22_15),
    potongan_pph23_2: formatRupiah(potongan_pph23_2),
    potongan_lainnya,
    total_potongan: formatRupiah(totalPotongan),
    jumlah_diterima: formatRupiah(jumlahDiterima),

    rincian,
  };
}
