import * as XLSX from "xlsx";
import { NextResponse } from "next/server";

// Template Excel untuk import pengajuan belanja secara massal.
// 3 sheet: Pengajuan (1 baris = 1 pengajuan/Nota Dinas), Rincian (1 baris =
// 1 item belanja, dihubungkan ke Pengajuan lewat kolom id_sementara), dan
// Potongan (opsional, khusus GU -- boleh dikosongkan kalau tidak ada
// potongan atau kalau pengajuannya LS).

export async function GET() {
  const wb = XLSX.utils.book_new();

  const petunjuk = [
    ["PETUNJUK PENGISIAN"],
    [""],
    ["1. Sheet 'Pengajuan' -- satu baris = satu Nota Dinas/pengajuan."],
    ["   - id_sementara: kode bebas Anda buat sendiri untuk menghubungkan baris ini ke sheet Rincian & Potongan (mis. PJK-001). Harus UNIK per pengajuan."],
    ["   - kode_rekening: HARUS SAMA PERSIS dengan kode rekening di menu Rekening & Pagu (mis. 5.1.02.02.001.00030)."],
    ["   - sumber_dana: isi kalau kode rekening yang sama punya lebih dari satu sumber dana (PAD/DBH CHT/dll). Boleh dikosongkan kalau cuma satu."],
    ["   - tahun_anggaran & tahapan: harus cocok dengan DPA yang sudah ada di aplikasi (tahapan: murni/pergeseran/perubahan)."],
    ["   - metode_pembayaran: isi LS atau GU."],
    ["   - status: isi 'dicairkan' untuk pengajuan yang sudah benar-benar cair (supaya ikut terhitung di Realisasi Sebelum & Sisa Anggaran pengajuan berikutnya). Isi 'draft' kalau belum final."],
    ["   - nama_penerima: khusus GU, nama penerima uang."],
    ["   - nama_penyedia: khusus LS, nama penyedia/rekanan. Kalau namanya belum ada di master Penyedia, akan DIBUATKAN OTOMATIS (data lain seperti NPWP bisa dilengkapi belakangan di menu Penyedia)."],
    [""],
    ["2. Sheet 'Rincian' -- satu baris = satu item belanja. Satu pengajuan boleh punya beberapa baris rincian, asal id_sementara-nya SAMA."],
    ["   - Jumlah pengajuan otomatis dihitung dari total (qty x harga_satuan) semua baris rincian dengan id_sementara yang sama."],
    [""],
    ["3. Sheet 'Potongan' -- OPSIONAL, boleh dikosongkan/dihapus baris contohnya. Isi kalau ada potongan pajak (Pajak Daerah, PPh Final, PPh 22, PPh 23, dst)."],
    [""],
    ["4. Setelah semua terisi, upload file ini di menu Pengajuan Belanja > Import."],
  ];
  const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjuk);
  wsPetunjuk["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, wsPetunjuk, "Petunjuk");

  const pengajuanHeader = [
    "id_sementara", "kode_rekening", "sumber_dana", "tahun_anggaran", "tahapan",
    "tanggal", "uraian_kegiatan", "metode_pembayaran", "status",
    "nomor_nota_dinas", "nomor_bukti", "nama_penerima", "nama_penyedia",
  ];
  const pengajuanContoh = [
    "PJK-001", "5.1.02.02.001.00030", "PAD", 2026, "murni",
    "2026-07-06", "Belanja Jasa Outsourcing Tenaga Kebersihan Perorangan bulan Juni 2026", "GU", "dicairkan",
    "935/001/35.79.121/2026", "935/001/35.79.121/2026", "Tengko Wolok, ST", "",
  ];
  const wsPengajuan = XLSX.utils.aoa_to_sheet([pengajuanHeader, pengajuanContoh]);
  wsPengajuan["!cols"] = pengajuanHeader.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, wsPengajuan, "Pengajuan");

  const rincianHeader = ["id_sementara", "nama_item", "qty", "satuan", "harga_satuan"];
  const rincianContoh = ["PJK-001", "Belanja Jasa Tenaga Kebersihan", 1, "bulan", 2750000];
  const wsRincian = XLSX.utils.aoa_to_sheet([rincianHeader, rincianContoh]);
  wsRincian["!cols"] = rincianHeader.map(() => ({ wch: 30 }));
  XLSX.utils.book_append_sheet(wb, wsRincian, "Rincian");

  const potonganHeader = ["id_sementara", "jenis_pajak", "persentase", "nominal"];
  const potonganContoh = ["PJK-001", "PPH 23 (2%)", 2, 55000];
  const wsPotongan = XLSX.utils.aoa_to_sheet([potonganHeader, potonganContoh]);
  wsPotongan["!cols"] = potonganHeader.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, wsPotongan, "Potongan");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Template_Import_Pengajuan_Belanja.xlsx"',
    },
  });
}
