"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { kodeRekeningBelanja } from "@/lib/format";
import { Plus, Trash2, Sparkles, Info, Search } from "lucide-react";

// Label rekening/DPA yang ditampilkan di combobox pencarian & dipakai untuk
// mencocokkan kata kunci -- gabungan kode rekening, uraian belanja, nama
// kegiatan/sub kegiatan/program, supaya pegawai bisa cari pakai salah satu
// dari itu (banyak yang lebih hafal nama kegiatan daripada kode rekening).
function labelRekening(d: any) {
  return `${d?.rekening?.kode_rekening ?? ""} -- ${d?.rekening?.jenis_belanja ?? ""}`;
}
function haystackRekening(d: any) {
  return [
    d?.rekening?.kode_rekening,
    d?.rekening?.jenis_belanja,
    d?.rekening?.sub_kegiatan?.nama_sub_kegiatan,
    d?.rekening?.sub_kegiatan?.kode_sub_kegiatan,
    d?.rekening?.sub_kegiatan?.kegiatan?.nama_kegiatan,
    d?.rekening?.sub_kegiatan?.kegiatan?.program?.nama_program,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// `_totalNego` adalah field UI SAJA (diawali underscore, distrip sebelum
// dikirim ke API/DB) -- cara alternatif mengisi harga_satuan: petugas
// isi TOTAL yang disepakati saat negosiasi, sistem yang membagi ke
// harga per satuan (presisi 4 desimal, lihat migrasi
// 20260726010000_perbesar_presisi_harga_satuan.sql) supaya kalau
// dikalikan qty lagi hasilnya kembali persis/hampir persis ke angka
// nego semula -- tidak selisih beberapa rupiah gara-gara pembulatan
// harga per unit.
// `kena_ppn_tambahan`: per-baris (BUKAN per-pengajuan) -- sebagian item
// Katalog Elektronik INAPROC dikenakan tambahan PPN 12% terpisah dari
// harga produk (lihat migrasi 20260726030000). Kalau dicentang, harga
// baris itu dianggap NETTO dan PPN-nya dihitung maju & dijumlah
// terpisah sebagai komponen 'tambahan', independen dari toggle PPN
// global pengajuan (yang tetap berlaku untuk baris yang tidak dicentang).
type Rincian = {
  nama_item: string;
  qty: number;
  satuan: string;
  harga_satuan: number;
  kena_ppn_tambahan?: boolean;
  _totalNego?: string;
};
// `totalNego` cuma state lokal di form (BUKAN dikirim ke database) --
// dipakai sebagai cara alternatif mengisi harga_satuan: petugas isi
// TOTAL yang disepakati saat negosiasi, sistem yang membagi ke harga
// per satuan (presisi 4 desimal, lihat migrasi
// 20260726010000_perbesar_presisi_harga_satuan.sql) supaya kalau
// dikalikan qty lagi hasilnya kembali persis/hampir persis ke angka
// nego semula -- tidak selisih beberapa rupiah gara-gara pembulatan.
// `tipe`: 'potongan' (default) = mengurangi Jumlah Diterima Penyedia
// (withholding PPh, atau PPN kalau harga sudah termasuk pajak).
// 'tambahan' = menambah Total Tagihan (PPN ketika harga yang diinput
// adalah harga NETTO/belum termasuk pajak -- lihat migrasi
// 20260726020000_tambah_tipe_potongan_pajak.sql & pembaruan sistem
// pajak Katalog Elektronik LKPP per 16 Juli 2025).
type Potongan = { jenis_pajak: string; persentase: number; nominal: number; tipe?: "potongan" | "tambahan" };
type JenisPengadaan = "barang" | "jasa_umum" | "jasa_boga_hotel";
type BentukUsaha = "badan_usaha" | "perseorangan";

// ---------------------------------------------------------
// Tarif & aturan pemungutan pajak oleh Bendahara Pemerintah dalam
// pengadaan barang/jasa -- mengacu pada PMK 51/2025 (pemungutan PPh 22,
// menggantikan PMK 34/2017), PMK 131/2024 & PMK 11/2025 (PPN 12% dengan
// DPP Nilai Lain 11/12 -- tarif efektif untuk barang/jasa non-mewah
// TETAP 11%, jadi angka di kalkulator ini tidak berubah), PP 58/2023 &
// PMK 168/2023 (PPh 21 atas jasa Bukan Pegawai orang pribadi), PMK
// 141/2015 (jenis Jasa Lain objek PPh 23), dan PP 23/2018 (PPh Final
// UMKM). Ini alat bantu hitung, BUKAN nasihat pajak final -- Bendahara/
// PPK tetap wajib memverifikasi status PKP, NPWP, bentuk penyedia, dan
// ketentuan terbaru sebelum SPJ diajukan, karena aturan pajak bisa
// berubah dan setiap transaksi punya konteks masing-masing.
//
// Poin penting yang dijaga di sini:
// - PPN HANYA dipungut kalau penyedia berstatus PKP (non-PKP tidak boleh
//   menerbitkan Faktur Pajak, jadi bukan objek pemungutan PPN sama sekali
//   -- bukan sekadar 0%).
// - Batas Rp 2.000.000 (tidak termasuk PPN, per transaksi/nota, tidak
//   boleh dipecah) berlaku untuk PPN dan PPh 22 (pembelian BARANG).
// - Untuk JASA: kalau penyedia BADAN USAHA (PT/CV/koperasi/dll) -> PPh
//   23 (2%/4% tanpa NPWP), TIDAK ada batas minimum. Kalau penyedia
//   PERSEORANGAN (orang pribadi) -> BUKAN PPh 23, tapi PPh 21 Bukan
//   Pegawai (DPP 50% x bruto, tarif progresif Pasal 17 UU PPh: 5% s.d.
//   Rp60jt/tahun berjalan, 15% di atasnya s.d. Rp250jt, dst; +20% kalau
//   tanpa NPWP). Salah kaprah yang sering terjadi di lapangan justru
//   sebaliknya (PPh 21 dikira "khusus honor", PPh 23 dikira "khusus
//   jasa") -- yang benar, penentunya adalah BENTUK PENYEDIA, bukan jenis
//   pembayarannya.
// - Kalkulator ini memakai tarif lapisan PERTAMA (5%/6%) sebagai
//   estimasi PPh 21 Bukan Pegawai untuk SATU transaksi ini saja.
//   Kumulatif penghasilan orang pribadi yang sama dalam satu tahun pajak
//   (yang menentukan lapisan tarif progresif berikutnya kalau berulang)
//   TIDAK dilacak otomatis oleh aplikasi ini -- Bendahara wajib
//   mengecek manual kalau penyedia perseorangan yang sama menerima
//   pembayaran berulang dalam tahun berjalan.
// - Tarif PPh 22/23 dobel kalau penyedia tidak ber-NPWP.
// - PPh Final UMKM (PP 23/2018) menggantikan PPh 22/23/21 (bukan PPN)
//   kalau penyedia sudah punya Surat Keterangan, dan tidak punya batas
//   minimum.
// - Pengadaan lewat E-Katalog/E-Purchasing/Toko Daring LKPP (Sistem
//   Informasi Pengadaan Pemerintah): per PMK 58/2022, marketplace/ritel
//   daring pengadaan itu sendiri yang DITUNJUK sebagai pemungut PPN/PPh
//   22 dan menyetorkannya -- BUKAN Bendahara. Kalau pembayaran dilakukan
//   dengan mekanisme Pembayaran Langsung (LS) lewat kanal tersebut,
//   Bendahara semestinya TIDAK memungut lagi (hindari pungutan ganda).
//   Kalkulator ini mengasumsikan pengadaan non-marketplace (Bendahara
//   yang memungut langsung); untuk transaksi lewat marketplace resmi,
//   cek dulu apakah pajak sudah dipungut otomatis di sana.
// ---------------------------------------------------------
const TARIF = {
  ppn: 0.11,
  batasMinPpnPph22: 2_000_000,
  pph22: 0.015,
  pph22TanpaNpwp: 0.03,
  pph23: 0.02,
  pph23TanpaNpwp: 0.04,
  pph21BukanPegawaiLapisan1: 0.05,
  pphFinalUmkm: 0.005,
  pajakDaerahRestoranHotel: 0.10,
};

function hitungPajakOtomatis({
  totalBelanja,
  jenisPengadaan,
  statusPkp,
  adaNpwp,
  pakaiPphFinal,
  bentukUsaha,
  paksaPph22DibawahBatas,
  alasanPaksaPph22,
  hargaTermasukPpn = true,
}: {
  totalBelanja: number;
  jenisPengadaan: JenisPengadaan;
  statusPkp: boolean;
  adaNpwp: boolean;
  pakaiPphFinal: boolean;
  bentukUsaha: BentukUsaha;
  // Override manual: sebagian penyedia (PKP Badan Usaha) tetap MINTA PPh
  // 22 dipotong walau transaksi di bawah Rp2 juta, biasanya supaya
  // mereka punya Bukti Potong untuk rekonsiliasi pembukuan/pelaporan
  // pajak sendiri. Ini BUKAN kewajiban Bendahara (PMK 59/2022 Pasal 18
  // membebaskan Bendahara dari kewajiban memotong di bawah batas itu),
  // tapi tidak dilarang juga kalau kedua pihak sepakat -- makanya
  // disediakan sebagai pilihan manual, bukan default, dan alasannya
  // WAJIB dicatat untuk jejak audit/SPJ.
  paksaPph22DibawahBatas?: boolean;
  alasanPaksaPph22?: string;
  // Skema harga: TRUE (default, skema lama) = harga yang diinput di
  // Rincian Item DIANGGAP SUDAH termasuk PPN (umum berlaku untuk
  // harga E-Katalog sebelum Juli 2025) -- PPN dihitung mundur (dibagi
  // 1,11) dan jadi POTONGAN yang mengurangi Jumlah Diterima Penyedia.
  // FALSE (skema baru) = harga yang diinput adalah harga NETTO/belum
  // termasuk PPN (sesuai pembaruan sistem pajak Katalog Elektronik
  // LKPP per 16 Juli 2025, di mana "Ringkasan Pesanan"/Surat Pesanan
  // menampilkan harga produk TANPA PPN dan PPN dihitung terpisah atas
  // total transaksi) -- PPN dihitung maju (dikali 1,11) dan jadi
  // TAMBAHAN yang menambah Total Tagihan, BUKAN mengurangi yang
  // diterima penyedia.
  hargaTermasukPpn?: boolean;
}): { hasil: Potongan[]; catatan: string[] } {
  if (totalBelanja <= 0) return { hasil: [], catatan: [] };
  const catatan: string[] = [];

  // Jasa boga/katering & hotel: DIKECUALIKAN dari PPN (Pasal 4A UU PPN jo.
  // PMK 70/2022 -- karena sudah jadi objek Pajak Daerah/PBJT Makanan-
  // Minuman, untuk hindari pajak berganda), TAPI TETAP kena PPh 23 (badan)
  // / PPh 21 Bukan Pegawai (perseorangan) seperti jasa lain -- PMK
  // 141/2015 Pasal 1(6)(aj) TEGAS memasukkan jasa boga/katering sebagai
  // objek PPh 23. Ini koreksi dari asumsi umum yang keliru bahwa jasa
  // katering "dikecualikan pajak" sepenuhnya -- yang dikecualikan
  // hanyalah PPN-nya.
  if (jenisPengadaan === "jasa_boga_hotel") {
    const dppInfo = totalBelanja / (1 + TARIF.pajakDaerahRestoranHotel);
    catatan.push(
      "Jasa boga/katering/hotel dikecualikan dari PPN (sudah jadi objek Pajak Daerah PBJT Makanan-Minuman, " +
        "lazimnya self-assessment oleh restoran/hotel & sudah termasuk di harga struk -- baris Pajak Daerah di " +
        "bawah murni informasi, BUKAN dipungut Bendahara). Tapi PPh 23/21 di bawah TETAP dipungut seperti jasa lain."
    );
    const hasilBoga: Potongan[] = [
      {
        jenis_pajak: "Pajak Daerah Restoran/Hotel 10% (informasi -- umumnya sudah termasuk di harga)",
        persentase: 10,
        nominal: Math.round(totalBelanja - dppInfo),
      },
    ];
    if (pakaiPphFinal) {
      hasilBoga.push({
        jenis_pajak: "PPh Final UMKM (PP 23/2018) 0,5%",
        persentase: 0.5,
        nominal: Math.round(totalBelanja * TARIF.pphFinalUmkm),
      });
    } else if (bentukUsaha === "perseorangan") {
      const dppPph21 = totalBelanja * 0.5;
      const tarif = adaNpwp ? TARIF.pph21BukanPegawaiLapisan1 : TARIF.pph21BukanPegawaiLapisan1 * 1.2;
      hasilBoga.push({
        jenis_pajak: `PPh 21 Bukan Pegawai ${adaNpwp ? "5%" : "6% (tanpa NPWP)"} x 50% bruto`,
        persentase: tarif * 100,
        nominal: Math.round(dppPph21 * tarif),
      });
    } else {
      const tarif = adaNpwp ? TARIF.pph23 : TARIF.pph23TanpaNpwp;
      hasilBoga.push({
        jenis_pajak: `PPh 23 ${adaNpwp ? "2%" : "4% (tanpa NPWP)"}`,
        persentase: tarif * 100,
        nominal: Math.round(totalBelanja * tarif),
      });
    }
    return { hasil: hasilBoga, catatan };
  }

  const hasil: Potongan[] = [];

  // DPP & nominal PPN beda rumus tergantung skema harga (lihat komentar
  // parameter `hargaTermasukPpn` di atas):
  // - Skema lama (hargaTermasukPpn=true, default): harga di Rincian Item
  //   dianggap sudah termasuk PPN -> DPP = total/1,11, PPN = total-DPP,
  //   dan PPN jadi POTONGAN (mengurangi yang diterima penyedia) karena
  //   PPN itu memang sudah "nempel" di angka yang sama.
  // - Skema baru (hargaTermasukPpn=false): harga di Rincian Item adalah
  //   harga NETTO -> DPP = total apa adanya, PPN = DPP x 11% dihitung
  //   MAJU, dan PPN jadi TAMBAHAN (menambah Total Tagihan) karena harga
  //   netto tidak mengandung PPN sama sekali -- kalau dipotongkan lagi
  //   dari totalBelanja, penyedia rugi dua kali.
  const dpp = statusPkp ? (hargaTermasukPpn ? totalBelanja / (1 + TARIF.ppn) : totalBelanja) : totalBelanja;
  const nominalPpn = hargaTermasukPpn ? Math.round(totalBelanja - dpp) : Math.round(dpp * TARIF.ppn);

  if (!statusPkp) {
    catatan.push(
      "Penyedia Non-PKP -- tidak boleh memungut/menerbitkan Faktur Pajak, sehingga transaksi ini " +
        "bukan objek pemungutan PPN sama sekali (bukan 0%, memang tidak dipungut)."
    );
  }

  if (statusPkp) {
    if (dpp >= TARIF.batasMinPpnPph22) {
      hasil.push({
        jenis_pajak: hargaTermasukPpn ? "PPN 11% (sudah termasuk di harga)" : "PPN 11% (tambahan atas harga netto)",
        persentase: 11,
        nominal: nominalPpn,
        tipe: hargaTermasukPpn ? "potongan" : "tambahan",
      });
      if (!hargaTermasukPpn) {
        catatan.push(
          "Harga di atas diperlakukan sebagai harga NETTO (belum termasuk PPN) -- PPN ditambahkan di atas " +
            "sebagai komponen Total Tagihan, BUKAN memotong yang diterima penyedia. Ini sesuai pembaruan sistem " +
            "penghitungan pajak Katalog Elektronik LKPP sejak 16 Juli 2025 (Surat Pesanan/Invoice menampilkan " +
            "harga produk tanpa PPN, PPN dihitung terpisah atas total transaksi). Cek juga: kalau barang/jasa " +
            "TIDAK tergolong mewah, tarif efektif PPN tetap 11% (DPP Nilai Lain 11/12 x 12%, PMK 131/2024) -- " +
            "kalau penyedia mengenakan flat 12% dari harga netto untuk barang non-mewah, itu KELEBIHAN pungut, " +
            "konfirmasikan ke penyedia sebelum dibayar."
        );
      }
    } else {
      catatan.push(
        `Nilai transaksi (DPP Rp${Math.round(dpp).toLocaleString("id-ID")}) di bawah Rp2.000.000 -- ` +
          "sesuai PMK 59/2022 Pasal 18, Bendahara TIDAK perlu memungut/menyetorkan PPN lewat mekanisme " +
          "khusus. Tapi PPN tetap TERUTANG: PKP wajib menerbitkan Faktur Pajak & menyetor sendiri PPN-nya " +
          "(self-assessment) lewat SPT Masa PPN mereka. Kalau harga/invoice dari penyedia sudah mencantumkan " +
          "PPN, itu SAH dan memang seharusnya begitu -- JANGAN dipungut lagi oleh Bendahara (hindari pungutan ganda)."
      );
    }
  }

  if (pakaiPphFinal) {
    hasil.push({
      jenis_pajak: "PPh Final UMKM (PP 23/2018) 0,5%",
      persentase: 0.5,
      nominal: Math.round(dpp * TARIF.pphFinalUmkm),
    });
  } else if (jenisPengadaan === "barang") {
    // PPh 22 (barang): batas Rp2jt sama seperti PPN.
    if (dpp >= TARIF.batasMinPpnPph22) {
      const tarif = adaNpwp ? TARIF.pph22 : TARIF.pph22TanpaNpwp;
      hasil.push({
        jenis_pajak: `PPh 22 ${adaNpwp ? "1,5%" : "3% (tanpa NPWP)"}`,
        persentase: tarif * 100,
        nominal: Math.round(dpp * tarif),
      });
    } else if (paksaPph22DibawahBatas) {
      // Override manual: penyedia minta tetap dipotong walau di bawah
      // batas. Lihat catatan di parameter fungsi ini.
      const tarif = adaNpwp ? TARIF.pph22 : TARIF.pph22TanpaNpwp;
      hasil.push({
        jenis_pajak: `PPh 22 ${adaNpwp ? "1,5%" : "3% (tanpa NPWP)"} (dipotong atas permintaan penyedia, di bawah batas Rp2 juta)`,
        persentase: tarif * 100,
        nominal: Math.round(dpp * tarif),
      });
      catatan.push(
        `Transaksi ini di bawah Rp2.000.000 sehingga Bendahara sebenarnya TIDAK wajib memotong PPh 22 ` +
          `(PMK 59/2022 Pasal 18), tapi tetap dipotong atas permintaan penyedia. Alasan/catatan: ` +
          `${alasanPaksaPph22?.trim() || "(tidak diisi -- lengkapi untuk jejak audit/SPJ)"}`
      );
    } else if (statusPkp) {
      catatan.push("PPh 22 juga tidak dipungut untuk transaksi barang di bawah Rp2.000.000.");
    } else {
      catatan.push(
        `Nilai transaksi (Rp${Math.round(dpp).toLocaleString("id-ID")}) di bawah Rp2.000.000 -- PPh 22 tidak dipungut.`
      );
    }
  } else if (bentukUsaha === "perseorangan") {
    // Jasa yang diberikan ORANG PRIBADI (perseorangan) BUKAN objek PPh 23
    // -- yang benar adalah PPh 21 Bukan Pegawai (PP 58/2023 & PMK
    // 168/2023), DPP-nya 50% dari penghasilan bruto, dikali tarif
    // progresif Pasal 17. Sama seperti PPh 23, tidak ada batas minimum
    // transaksi.
    const dppPph21 = dpp * 0.5;
    const tarif = adaNpwp ? TARIF.pph21BukanPegawaiLapisan1 : TARIF.pph21BukanPegawaiLapisan1 * 1.2;
    hasil.push({
      jenis_pajak: `PPh 21 Bukan Pegawai ${adaNpwp ? "5%" : "6% (tanpa NPWP)"} x 50% bruto`,
      persentase: tarif * 100,
      nominal: Math.round(dppPph21 * tarif),
    });
    catatan.push(
      "Penyedia berstatus Perseorangan (orang pribadi) -- dipotong PPh 21 Bukan Pegawai, BUKAN PPh 23. " +
        "Tarif 5%/6% di atas adalah lapisan pertama (estimasi transaksi ini saja); kalau orang yang sama " +
        "menerima pembayaran lain dalam tahun berjalan sehingga kumulatifnya tembus Rp60 juta, lapisan " +
        "tarifnya naik (15%/25%/dst) -- cek manual, aplikasi ini tidak melacak akumulasi antar pengajuan."
    );
  } else {
    // PPh 23 (jasa oleh BADAN USAHA): TIDAK ada batas minimum, selalu dipungut penuh.
    const tarif = adaNpwp ? TARIF.pph23 : TARIF.pph23TanpaNpwp;
    hasil.push({
      jenis_pajak: `PPh 23 ${adaNpwp ? "2%" : "4% (tanpa NPWP)"}`,
      persentase: tarif * 100,
      nominal: Math.round(dpp * tarif),
    });
  }

  return { hasil, catatan };
}

export default function PengajuanForm({
  mode,
  pengajuanId,
}: {
  mode: "create" | "edit";
  pengajuanId?: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [dpaOptions, setDpaOptions] = useState<any[]>([]);
  const [penyediaOptions, setPenyediaOptions] = useState<any[]>([]);
  const [penerimaSaran, setPenerimaSaran] = useState<string[]>([]);
  const [periode, setPeriode] = useState<{ tahun: number; tahapan: string } | null>(null);
  const [sisaAnggaran, setSisaAnggaran] = useState<number | null>(null);
  const [loading, setLoading] = useState(mode === "edit");

  const [dpaId, setDpaId] = useState("");
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [metodePembayaran, setMetodePembayaran] = useState<"LS" | "GU">("GU");
  const [nomorNotaDinas, setNomorNotaDinas] = useState("");
  const [nomorBukti, setNomorBukti] = useState("");
  const [uraian, setUraian] = useState("");
  const [penyediaId, setPenyediaId] = useState("");
  const [namaPenerima, setNamaPenerima] = useState("");
  const [penerimaDiubahManual, setPenerimaDiubahManual] = useState(false);
  const [rincian, setRincian] = useState<Rincian[]>([{ nama_item: "", qty: 1, satuan: "", harga_satuan: 0 }]);
  const [potongan, setPotongan] = useState<Potongan[]>([]);
  const [catatanPajak, setCatatanPajak] = useState<string[]>([]);
  const [jenisPengadaan, setJenisPengadaan] = useState<JenisPengadaan>("barang");
  const [eKatalog, setEKatalog] = useState(false);
  // Transaksi lewat E-Katalog/E-Purchasing INAPROC di bawah Rp2 juta:
  // metode pembayaran GU otomatis & pajak dipungut/disetor oleh sistem
  // Katalog sendiri -- TIDAK perlu dihitung ulang di aplikasi ini (lihat
  // pemakaian `pajakDitanganiKatalog` di bawah). Kalau pembayarannya
  // ternyata dilaksanakan DI LUAR sistem Katalog (mis. transaksi melewati
  // batas kode bayar Katalog), centang toggle ini supaya aturan otomatis
  // di atas TIDAK berlaku & perhitungan pajak manual kembali muncul.
  const [pembayaranDiluarKatalog, setPembayaranDiluarKatalog] = useState(false);
  const [paksaPph22DibawahBatas, setPaksaPph22DibawahBatas] = useState(false);
  const [alasanPaksaPph22, setAlasanPaksaPph22] = useState("");
  const [hargaTermasukPpn, setHargaTermasukPpn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Combobox pencarian Rekening/DPA (lihat labelRekening/haystackRekening di
  // atas) -- diminta pegawai supaya bisa cari rekening lewat nama
  // kegiatan/sub kegiatan, bukan cuma hafal kode rekening.
  const [rekeningQuery, setRekeningQuery] = useState("");
  const [rekeningOpen, setRekeningOpen] = useState(false);
  const rekeningBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: penyedia } = await supabase
        .from("penyedia")
        .select("id, nama_penyedia, nama_direktur, npwp, status_pkp, bentuk_usaha, pph_final_umkm")
        .order("nama_penyedia");
      setPenyediaOptions(penyedia ?? []);

      // Tidak ada lagi tabel `penerima` terpisah -- nama penerima teks
      // bebas, saran (datalist) diambil dari nama yang pernah dipakai.
      const { data: pernahDipakai } = await supabase
        .from("pengajuan_belanja")
        .select("nama_penerima")
        .not("nama_penerima", "is", null)
        .limit(200);
      const unik = Array.from(new Set((pernahDipakai ?? []).map((r: any) => r.nama_penerima).filter(Boolean)));
      setPenerimaSaran(unik as string[]);

      if (mode === "edit" && pengajuanId) {
        // Mode edit: rekening/DPA yang boleh dipilih mengikuti periode
        // (tahun+tahapan) milik pengajuan itu SENDIRI, bukan periode aktif
        // saat ini -- supaya tetap konsisten kalau periode aktif sudah
        // berganti sejak pengajuan ini dibuat.
        const { data: existing } = await supabase
          .from("pengajuan_belanja")
          .select(
            "id, dpa_id, tanggal, uraian_kegiatan, penyedia_id, nama_penerima, metode_pembayaran, nomor_nota_dinas, nomor_bukti, dpa:dpa(tahun_anggaran, tahapan)"
          )
          .eq("id", pengajuanId)
          .single();

        if (existing) {
          setDpaId(existing.dpa_id);
          setTanggal(existing.tanggal);
          setUraian(existing.uraian_kegiatan);
          setPenyediaId(existing.penyedia_id ?? "");
          setNamaPenerima(existing.nama_penerima ?? "");
          setPenerimaDiubahManual(true); // jangan timpa nama penerima yang sudah tersimpan
          setMetodePembayaran((existing as any).metode_pembayaran || "GU");
          setNomorNotaDinas((existing as any).nomor_nota_dinas || "");
          setNomorBukti((existing as any).nomor_bukti || "");

          const dpaPeriode = existing.dpa as any;
          setPeriode({ tahun: dpaPeriode?.tahun_anggaran, tahapan: dpaPeriode?.tahapan });

          const { data: dpa } = await supabase
            .from("dpa")
            .select(
              "id, tahapan, pagu_anggaran, rekening_id, pptk:pejabat_skpd(nama), rekening:rekening_belanja(kode_rekening, jenis_belanja, kelompok_belanja, sumber_dana, sub_kegiatan:sub_kegiatan(kode_sub_kegiatan, nama_sub_kegiatan, kegiatan:kegiatan(nama_kegiatan, program:program(nama_program))))"
            )
            .eq("tahun_anggaran", dpaPeriode?.tahun_anggaran)
            .eq("tahapan", dpaPeriode?.tahapan);
          setDpaOptions(dpa ?? []);

          const [{ data: rincianData }, { data: potonganData }] = await Promise.all([
            supabase.from("rincian_belanja").select("nama_item, qty, satuan, harga_satuan, kena_ppn_tambahan").eq("pengajuan_id", pengajuanId),
            supabase.from("potongan_pajak").select("jenis_pajak, persentase, nominal, tipe").eq("pengajuan_id", pengajuanId),
          ]);
          if (rincianData && rincianData.length > 0) setRincian(rincianData as Rincian[]);
          if (potonganData) setPotongan(potonganData as Potongan[]);
        }
        setLoading(false);
      } else {
        // Mode tambah: periode aktif (tahun+tahapan) disimpan di cookie
        // httpOnly server, diambil lewat endpoint kecil ini.
        const periodeRes = await fetch("/api/periode-aktif").then((r) => r.json());
        setPeriode(periodeRes);

        const { data: dpa } = await supabase
          .from("dpa")
          .select(
            "id, tahapan, pagu_anggaran, rekening_id, pptk:pejabat_skpd(nama), rekening:rekening_belanja(kode_rekening, jenis_belanja, kelompok_belanja, sumber_dana, sub_kegiatan:sub_kegiatan(kode_sub_kegiatan, nama_sub_kegiatan, kegiatan:kegiatan(nama_kegiatan, program:program(nama_program))))"
          )
          .eq("tahun_anggaran", periodeRes.tahun)
          .eq("tahapan", periodeRes.tahapan);
        setDpaOptions(dpa ?? []);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dpaTerpilih = useMemo(() => dpaOptions.find((d: any) => d.id === dpaId), [dpaOptions, dpaId]);

  // Rekening yang cocok dengan kata kunci pencarian -- kata kunci dipecah per
  // kata, dan SEMUA kata harus ketemu di gabungan kode rekening/kegiatan/sub
  // kegiatan/uraian belanja (supaya "listrik kantor" bisa nemu meski urutan
  // katanya beda dari nama rekening aslinya).
  const dpaOptionsTersaring = useMemo(() => {
    const kataKunci = rekeningQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (kataKunci.length === 0) return dpaOptions;
    return dpaOptions.filter((d: any) => {
      const hay = haystackRekening(d);
      return kataKunci.every((k) => hay.includes(k));
    });
  }, [dpaOptions, rekeningQuery]);

  // Sinkronkan teks di kotak pencarian dengan rekening yang sedang dipilih --
  // hanya saat dropdown TERTUTUP, supaya tidak menimpa ketikan pegawai saat
  // sedang mencari.
  useEffect(() => {
    if (!rekeningOpen) setRekeningQuery(dpaTerpilih ? labelRekening(dpaTerpilih) : "");
  }, [dpaTerpilih, rekeningOpen]);

  // Tutup dropdown pencarian kalau klik di luar kotaknya.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rekeningBoxRef.current && !rekeningBoxRef.current.contains(e.target as Node)) {
        setRekeningOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const penyediaTerpilih = useMemo(
    () => penyediaOptions.find((p: any) => p.id === penyediaId),
    [penyediaOptions, penyediaId]
  );

  // Sisa anggaran rekening yang dipilih -- pagu (sesuai tahapan yang
  // dipilih) dikurangi realisasi lain yang sudah disetujui/dicairkan.
  // Realisasi diakumulasi dari SEMUA tahapan (murni + pergeseran +
  // perubahan) pada rekening & tahun anggaran yang sama -- bukan cuma
  // dari dpa_id tahapan yang sedang dipilih -- supaya konsisten dengan
  // formula yang sama di menu Rekap (lihat migrasi
  // 20260726000000_akumulasi_realisasi_lintas_tahapan.sql).
  useEffect(() => {
    if (!dpaId) return setSisaAnggaran(null);
    const dpaTerpilihSaatIni = dpaOptions.find((d: any) => d.id === dpaId);
    const rekeningId = dpaTerpilihSaatIni?.rekening_id;
    if (!rekeningId || !periode?.tahun) return setSisaAnggaran(null);
    (async () => {
      const { data: dpaSerekening } = await supabase
        .from("dpa")
        .select("id")
        .eq("rekening_id", rekeningId)
        .eq("tahun_anggaran", periode.tahun);
      const dpaIds = (dpaSerekening ?? []).map((d: any) => d.id);
      if (dpaIds.length === 0) return setSisaAnggaran(null);

      const { data: realisasiLain } = await supabase
        .from("pengajuan_belanja")
        .select("id, jumlah_pengajuan")
        .in("dpa_id", dpaIds)
        .in("status", ["disetujui", "dicairkan"]);
      const totalRealisasiLain = (realisasiLain ?? [])
        .filter((r: any) => r.id !== pengajuanId)
        .reduce((s: number, r: any) => s + Number(r.jumlah_pengajuan || 0), 0);
      const pagu = dpaTerpilihSaatIni?.pagu_anggaran ?? 0;
      setSisaAnggaran(Number(pagu) - totalRealisasiLain);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dpaId, dpaOptions, periode]);

  // Penyedia dipilih -> nama penerima kwitansi otomatis diisi dari Nama
  // Direktur/Penanggung Jawab (sesuai data Penyedia Barang/Jasa), selama
  // belum diubah manual oleh Bendahara.
  function handlePilihPenyedia(id: string) {
    setPenyediaId(id);
    if (!penerimaDiubahManual) {
      const p = penyediaOptions.find((x: any) => x.id === id);
      setNamaPenerima(p?.nama_direktur || "");
    }
  }

  const totalBelanja = rincian.reduce((s, r) => s + Number(r.qty || 0) * Number(r.harga_satuan || 0), 0);
  // Basis khusus untuk item yang ditandai `kena_ppn_tambahan` (lihat
  // migrasi 20260726030000) -- dipisah dari totalBelanja karena PPN-nya
  // dihitung MAJU & terpisah, independen dari toggle "Harga sudah
  // termasuk PPN" global yang cuma berlaku untuk item lainnya.
  const totalBasisPpnTambahanPerItem = rincian
    .filter((r) => r.kena_ppn_tambahan)
    .reduce((s, r) => s + Number(r.qty || 0) * Number(r.harga_satuan || 0), 0);
  const totalBelanjaTanpaPpnTambahanPerItem = totalBelanja - totalBasisPpnTambahanPerItem;

  // Catatan dari hasil uji coba pegawai (poin 4 & 6):
  // - Belanja barang/jasa lewat E-Katalog INAPROC dengan nilai DI BAWAH
  //   Rp2 juta: metode pembayaran otomatis GU, dan pemotongan pajak sudah
  //   dilakukan oleh sistem Katalog sendiri -- TIDAK perlu dihitung lagi
  //   di aplikasi ini.
  // - Begitu metode pembayarannya LS, ATAU nilainya sudah Rp2 juta atau
  //   lebih, ATAU pegawai menandai transaksi dilaksanakan di luar sistem
  //   Katalog (mis. melewati batas kode bayar Katalog) -- pemungutan
  //   pajak kembali sepenuhnya jadi tanggung jawab aplikasi ini, sesuai
  //   ketentuan pajak pengadaan barang/jasa pemerintah yang berlaku, baik
  //   transaksinya lewat e-Katalog/toko daring ataupun tidak.
  const pajakDitanganiSistemKatalog =
    eKatalog && totalBelanja > 0 && totalBelanja < TARIF.batasMinPpnPph22 && !pembayaranDiluarKatalog;

  useEffect(() => {
    if (pajakDitanganiSistemKatalog && metodePembayaran !== "GU") {
      setMetodePembayaran("GU");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pajakDitanganiSistemKatalog]);

  function updateRincian(i: number, patch: Partial<Rincian>) {
    setRincian((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  // Isi harga_satuan dari TOTAL nego (dibagi qty), presisi 4 desimal --
  // lihat komentar di definisi type Rincian & migrasi presisi harga.
  function updateTotalNego(i: number, totalNegoStr: string) {
    const total = Number(totalNegoStr.replace(/[^0-9.-]/g, ""));
    setRincian((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const qty = Number(r.qty || 0);
        const harga_satuan = qty > 0 && total > 0 ? Math.round((total / qty) * 10000) / 10000 : r.harga_satuan;
        return { ...r, harga_satuan, _totalNego: totalNegoStr };
      })
    );
  }
  function updatePotongan(i: number, patch: Partial<Potongan>) {
    setPotongan((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function handleHitungOtomatis() {
    // Lewat E-Katalog di bawah Rp2 juta -- pajak sudah ditangani sistem
    // Katalog, jangan hitung/tambahkan potongan apa pun di sini (poin 4).
    if (pajakDitanganiSistemKatalog) {
      setPotongan([]);
      setCatatanPajak([]);
      return;
    }
    // Item yang TIDAK ditandai `kena_ppn_tambahan` tetap lewat alur
    // perhitungan lengkap seperti biasa (PPN global, PPh 22/23/21,
    // dst). Ambang Rp2 juta PPN/PPh 22 di sini otomatis hanya menimbang
    // total item-item ini -- kalau nota digabung dengan item ber-PPN
    // tambahan terpisah, cek manual apakah ambang batas seharusnya
    // dihitung dari total keseluruhan nota (aturan "per transaksi/nota",
    // bukan per baris/item).
    const { hasil, catatan } = hitungPajakOtomatis({
      totalBelanja: totalBelanjaTanpaPpnTambahanPerItem,
      jenisPengadaan,
      statusPkp: Boolean(penyediaTerpilih?.status_pkp),
      adaNpwp: Boolean(penyediaTerpilih?.npwp),
      pakaiPphFinal: Boolean(penyediaTerpilih?.pph_final_umkm),
      bentukUsaha: (penyediaTerpilih?.bentuk_usaha as BentukUsaha) || "badan_usaha",
      paksaPph22DibawahBatas,
      alasanPaksaPph22,
      hargaTermasukPpn,
    });

    // Item yang DITANDAI `kena_ppn_tambahan`: PPN dihitung maju dari
    // harga netto per item, dijumlah jadi satu baris 'tambahan'
    // terpisah -- tidak lewat DPP/toggle global di atas.
    const jumlahItemPpnTambahan = rincian.filter((r) => r.kena_ppn_tambahan).length;
    if (totalBasisPpnTambahanPerItem > 0 && jumlahItemPpnTambahan > 0) {
      const nominalPpnTambahan = Math.round(totalBasisPpnTambahanPerItem * TARIF.ppn);
      hasil.push({
        jenis_pajak: `PPN 11% tambahan -- ${jumlahItemPpnTambahan} item Katalog dgn PPN terpisah`,
        persentase: 11,
        nominal: nominalPpnTambahan,
        tipe: "tambahan",
      });
      catatan.push(
        `${jumlahItemPpnTambahan} item ditandai dikenakan PPN tambahan terpisah (basis netto Rp${totalBasisPpnTambahanPerItem.toLocaleString("id-ID")}) -- ` +
          "dihitung dengan tarif efektif 11% (DPP Nilai Lain 11/12, PMK 131/2024). Kalau item-item ini BUKAN " +
          "barang mewah tapi Faktur Pajak/invoice penyedia mengenakan flat 12% dari harga netto, itu kelebihan " +
          "pungut -- konfirmasikan ke penyedia sebelum dibayar."
      );
    }

    setPotongan(hasil);
    setCatatanPajak(catatan);
  }

  async function handleSubmit() {
    setErrorMsg("");
    if (!dpaId) return setErrorMsg("Pilih rekening/DPA dulu.");
    if (!uraian.trim()) return setErrorMsg("Uraian kegiatan wajib diisi.");
    if (rincian.some((r) => !r.nama_item || !r.satuan)) return setErrorMsg("Lengkapi semua rincian item.");

    setSaving(true);
    const payload = {
      dpa_id: dpaId,
      tanggal,
      uraian_kegiatan: uraian,
      penyedia_id: penyediaId || null,
      nama_penerima: namaPenerima.trim() || null,
      metode_pembayaran: metodePembayaran,
      nomor_nota_dinas: nomorNotaDinas.trim() || null,
      nomor_bukti: nomorBukti.trim() || null,
      // `_totalNego` murni bantuan input di UI, jangan ikut dikirim --
      // kolom itu tidak ada di tabel rincian_belanja.
      rincian: rincian.map(({ _totalNego, ...r }) => r),
      potongan: potongan.filter((p) => p.nominal !== 0),
    };

    const res =
      mode === "edit"
        ? await fetch(`/api/pengajuan/${pengajuanId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/pengajuan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

    setSaving(false);
    if (!res.ok) {
      const j = await res.json();
      setErrorMsg(j.error || "Gagal menyimpan.");
      return;
    }
    router.push("/pengajuan");
    router.refresh();
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Memuat data pengajuan...</p>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-serif text-xl text-slate-900">
          {mode === "edit" ? "Edit Pengajuan Belanja" : "Pengajuan Belanja Baru"}
        </h1>
        <p className="text-sm text-slate-500">
          Isi sekali di sini -- Nota Dinas, SPP/SPTJB, dan Kwitansi GU akan dibuat otomatis dari data yang sama.
          {periode && (
            <> Daftar rekening di bawah mengikuti periode {mode === "edit" ? "milik pengajuan ini" : "aktif"}:
              Tahun Anggaran {periode.tahun}, Tahapan {periode.tahapan}.</>
          )}
        </p>
      </div>

      {errorMsg && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{errorMsg}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <p className="text-[11px] text-slate-400 uppercase tracking-wide -mb-1">
          Pilih rekening, lalu isi field di bawah ini secara manual
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div ref={rekeningBoxRef} className="relative">
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Rekening / DPA</label>
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={rekeningQuery}
                onChange={(e) => {
                  setRekeningQuery(e.target.value);
                  setRekeningOpen(true);
                  if (dpaId) setDpaId(""); // ketikan baru berarti sedang cari ulang, bukan rekening yang sudah dipilih
                }}
                onFocus={() => setRekeningOpen(true)}
                placeholder="Cari kode rekening, kegiatan, atau sub kegiatan..."
                className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-2 outline-none"
              />
            </div>
            {rekeningOpen && (
              <div className="absolute z-20 mt-1 w-full max-h-72 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                {dpaOptionsTersaring.length === 0 && (
                  <p className="text-xs text-slate-400 px-3 py-3">Tidak ada rekening yang cocok.</p>
                )}
                {dpaOptionsTersaring.map((d: any) => (
                  <button
                    type="button"
                    key={d.id}
                    onClick={() => {
                      setDpaId(d.id);
                      setRekeningQuery(labelRekening(d));
                      setRekeningOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0 ${
                      d.id === dpaId ? "bg-emerald-50" : ""
                    }`}
                  >
                    <p className="font-mono text-slate-700">{d.rekening?.kode_rekening}</p>
                    <p className="text-slate-500">{d.rekening?.jenis_belanja}</p>
                    <p className="text-slate-400">
                      {d.rekening?.sub_kegiatan?.kegiatan?.nama_kegiatan} -- {d.rekening?.sub_kegiatan?.nama_sub_kegiatan}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Tanggal</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Metode Pembayaran</label>
            <select
              value={metodePembayaran}
              onChange={(e) => setMetodePembayaran(e.target.value as "LS" | "GU")}
              disabled={pajakDitanganiSistemKatalog}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="GU">GU (Ganti Uang)</option>
              <option value="LS">LS (Langsung)</option>
            </select>
            {pajakDitanganiSistemKatalog ? (
              <p className="text-[11px] text-slate-400 mt-1">
                Otomatis GU -- transaksi E-Katalog di bawah Rp2 juta (lihat catatan di bagian Potongan Pajak di bawah).
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1">
                Menentukan teks "Pengajuan Pencairan {metodePembayaran}" di Nota Dinas & SPP/SPTJB.
                {metodePembayaran === "LS" && " Kwitansi GU tidak relevan untuk LS."}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Nomor Nota Dinas</label>
            <input
              type="text"
              value={nomorNotaDinas}
              onChange={(e) => setNomorNotaDinas(e.target.value)}
              placeholder={`${metodePembayaran === "LS" ? "935" : "934"}/___/35.79.121/${periode?.tahun ?? "2026"}`}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">Diisi manual sesuai buku agenda surat keluar.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Nomor Bukti (Kwitansi)</label>
            <input
              type="text"
              value={nomorBukti}
              onChange={(e) => setNomorBukti(e.target.value)}
              placeholder={`${metodePembayaran === "LS" ? "935" : "934"}/___/35.79.121/${periode?.tahun ?? "2026"}`}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">Diisi manual, boleh sama dengan Nomor Nota Dinas.</p>
          </div>
        </div>

        {dpaTerpilih && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-600 space-y-1.5">
            <p className="text-[11px] text-slate-400 uppercase tracking-wide">Data berikut otomatis dari Rekening &amp; Pagu (database) -- bukan isian manual</p>
            <p>
              <span className="text-slate-400">Program:</span>{" "}
              {dpaTerpilih.rekening?.sub_kegiatan?.kegiatan?.program?.nama_program || "-"}
            </p>
            <p>
              <span className="text-slate-400">Kegiatan:</span>{" "}
              {dpaTerpilih.rekening?.sub_kegiatan?.kegiatan?.nama_kegiatan || "-"}
            </p>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
              <p><span className="text-slate-400">Sub Kegiatan:</span> {dpaTerpilih.rekening?.sub_kegiatan?.nama_sub_kegiatan || "-"}</p>
              <p><span className="text-slate-400">Kode Rekening:</span> {dpaTerpilih.rekening?.kode_rekening || "-"}</p>
              <p><span className="text-slate-400">Kode Rekening Belanja:</span> {kodeRekeningBelanja(dpaTerpilih.rekening?.kode_rekening)}</p>
              <p><span className="text-slate-400">Jenis Belanja:</span> {dpaTerpilih.rekening?.kelompok_belanja || "-"}</p>
              <p><span className="text-slate-400">Sumber Dana:</span> {dpaTerpilih.rekening?.sumber_dana || "-"}</p>
              <p><span className="text-slate-400">PPTK:</span> {dpaTerpilih.pptk?.nama || "-- belum ditentukan di Rekening & Pagu --"}</p>
              <p><span className="text-slate-400">Pagu:</span> Rp {Number(dpaTerpilih.pagu_anggaran || 0).toLocaleString("id-ID")}</p>
            </div>
            {sisaAnggaran !== null && (
              <p>
                <span className="text-slate-400">Sisa Anggaran (setelah pengajuan ini):</span>{" "}
                <span className={sisaAnggaran - totalBelanja < 0 ? "text-rose-600 font-medium" : "text-emerald-700 font-medium"}>
                  Rp {(sisaAnggaran - totalBelanja).toLocaleString("id-ID")}
                </span>
              </p>
            )}
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Uraian Kegiatan (lengkap)</label>
          <textarea
            value={uraian}
            onChange={(e) => setUraian(e.target.value)}
            rows={3}
            placeholder="mis. Rapat evaluasi penggunaan anggaran DBH CHT Tahun 2026 dan persiapan penyusunan P-RKP..."
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Penyedia (opsional -- cari & pilih)</label>
            <select
              value={penyediaId}
              onChange={(e) => handlePilihPenyedia(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
            >
              <option value="">-- tidak lewat penyedia --</option>
              {penyediaOptions.map((p: any) => (
                <option key={p.id} value={p.id}>{p.nama_penyedia}</option>
              ))}
            </select>
            {penyediaTerpilih && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                  {penyediaTerpilih.bentuk_usaha === "perseorangan" ? "Perseorangan" : "Badan Usaha"}
                </span>
                <span className={`text-xs rounded-full px-2 py-0.5 ${penyediaTerpilih.status_pkp ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-500"}`}>
                  {penyediaTerpilih.status_pkp ? "PKP" : "Non-PKP"}
                </span>
                <span className={`text-xs rounded-full px-2 py-0.5 ${penyediaTerpilih.npwp ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                  {penyediaTerpilih.npwp ? "Ber-NPWP" : "Tanpa NPWP"}
                </span>
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Penerima</label>
            <input
              list="saran-penerima"
              value={namaPenerima}
              onChange={(e) => {
                setNamaPenerima(e.target.value);
                setPenerimaDiubahManual(true);
              }}
              placeholder="Ketik nama penerima"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
            />
            <datalist id="saran-penerima">
              {penerimaSaran.map((nama) => (
                <option key={nama} value={nama} />
              ))}
            </datalist>
            <p className="text-xs text-slate-400 mt-1">
              Otomatis terisi dari Nama Direktur/Penanggung Jawab saat memilih Penyedia -- bisa diketik ulang manual bila perlu.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-900">Rincian Item</p>
          <button
            onClick={() => setRincian([...rincian, { nama_item: "", qty: 1, satuan: "", harga_satuan: 0 }])}
            className="text-xs flex items-center gap-1 text-emerald-600 font-medium"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah item
          </button>
        </div>
        <div className="space-y-2">
          {rincian.map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                placeholder="Nama item"
                value={r.nama_item}
                onChange={(e) => updateRincian(i, { nama_item: e.target.value })}
                className="col-span-4 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
              />
              <input
                type="number"
                placeholder="Qty"
                value={r.qty}
                onChange={(e) => updateRincian(i, { qty: Number(e.target.value) })}
                className="col-span-2 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
              />
              <input
                placeholder="Satuan"
                value={r.satuan}
                onChange={(e) => updateRincian(i, { satuan: e.target.value })}
                className="col-span-2 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
              />
              <input
                type="number"
                step="0.0001"
                placeholder="Harga satuan"
                value={r.harga_satuan}
                onChange={(e) => updateRincian(i, { harga_satuan: Number(e.target.value), _totalNego: undefined })}
                className="col-span-3 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
              />
              <button
                onClick={() => setRincian(rincian.filter((_, idx) => idx !== i))}
                className="col-span-1 text-rose-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="col-span-11 col-start-2 flex items-center gap-2">
                <span className="text-[11px] text-slate-400 shrink-0">
                  atau isi Total Nego (dibagi qty otomatis):
                </span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Total hasil negosiasi (opsional)"
                  value={r._totalNego ?? ""}
                  onChange={(e) => updateTotalNego(i, e.target.value)}
                  className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-500"
                />
                {r._totalNego && (
                  <span className="text-[11px] text-slate-400 shrink-0">
                    = Rp{Number(r.harga_satuan).toLocaleString("id-ID", { maximumFractionDigits: 4 })}/satuan
                  </span>
                )}
              </div>
              <label className="col-span-11 col-start-2 flex items-center gap-1.5 text-[11px] text-amber-700">
                <input
                  type="checkbox"
                  checked={Boolean(r.kena_ppn_tambahan)}
                  onChange={(e) => updateRincian(i, { kena_ppn_tambahan: e.target.checked })}
                  className="h-3 w-3"
                />
                Item ini dikenakan tambahan PPN 12% terpisah (mis. item Katalog Elektronik INAPROC tertentu) --
                harga di atas dianggap netto, PPN dihitung maju &amp; tidak memotong yang diterima penyedia.
              </label>
            </div>
          ))}
        </div>
        <p className="text-sm font-medium text-slate-900 mt-3">
          Total: Rp {totalBelanja.toLocaleString("id-ID")}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-900">Potongan Pajak</p>
        </div>

        <div className="flex flex-wrap items-end gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Jenis Pengadaan</label>
            <select
              value={jenisPengadaan}
              onChange={(e) => setJenisPengadaan(e.target.value as JenisPengadaan)}
              className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
            >
              <option value="barang">Barang</option>
              <option value="jasa_umum">Jasa Umum</option>
              <option value="jasa_boga_hotel">Jasa Boga/Katering/Hotel</option>
            </select>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 pb-2">
            <input type="checkbox" checked={eKatalog} onChange={(e) => setEKatalog(e.target.checked)} className="h-3.5 w-3.5" />
            Lewat E-Katalog/E-Purchasing LKPP
          </label>
          {eKatalog && totalBelanja > 0 && totalBelanja < TARIF.batasMinPpnPph22 && (
            <label className="flex items-center gap-1.5 text-xs text-slate-600 pb-2">
              <input
                type="checkbox"
                checked={pembayaranDiluarKatalog}
                onChange={(e) => setPembayaranDiluarKatalog(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Pembayaran dilaksanakan di luar sistem Katalog (mis. melewati batas kode bayar)
            </label>
          )}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 pb-2">
            <input
              type="checkbox"
              checked={hargaTermasukPpn}
              onChange={(e) => setHargaTermasukPpn(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Harga Rincian Item di atas sudah termasuk PPN
          </label>
          <button
            type="button"
            onClick={handleHitungOtomatis}
            disabled={pajakDitanganiSistemKatalog}
            className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg px-3 py-2"
          >
            <Sparkles className="h-3.5 w-3.5" /> Hitung Otomatis
          </button>
          <p className="text-xs text-slate-400 flex-1 min-w-[220px]">
            Mengikuti PMK 51/2025 (PPh 22), PP 58/2023 &amp; PMK 168/2023 (PPh 21 Bukan Pegawai -- kalau
            Penyedia Perseorangan), PMK 141/2015 (PPh 23 -- kalau Penyedia Badan Usaha), status PKP/NPWP/
            Bentuk Penyedia di atas, dan PPh Final UMKM bila ditandai di data Penyedia. Alat bantu hitung,
            bukan nasihat pajak final -- Bendahara/PPK tetap wajib memverifikasi sebelum SPJ diajukan.
          </p>
        </div>

        {pajakDitanganiSistemKatalog && (
          <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-3">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
              Transaksi E-Katalog/E-Purchasing INAPROC di bawah Rp2.000.000: metode pembayaran otomatis GU dan
              pemungutan/penyetoran pajak sudah dilakukan oleh sistem Katalog sendiri -- <strong>tidak perlu
              dihitung atau ditambahkan lagi</strong> di aplikasi ini. Kalau pembayarannya ternyata dilaksanakan
              di luar sistem Katalog (mis. transaksi melewati batas kode bayar), centang toggle "Pembayaran
              dilaksanakan di luar sistem Katalog" di atas supaya kalkulator pajak manual di bawah aktif kembali.
              Untuk metode LS, atau transaksi Rp2.000.000 ke atas (lewat E-Katalog/toko daring ataupun tidak),
              pemungutan pajak tetap sepenuhnya mengikuti ketentuan yang berlaku dan dihitung di sini seperti biasa.
            </p>
          </div>
        )}

        <div className="bg-amber-50/60 border border-amber-100 rounded-lg p-3 mb-3 space-y-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={paksaPph22DibawahBatas}
              onChange={(e) => setPaksaPph22DibawahBatas(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Penyedia tetap minta PPh 22 dipotong walau transaksi di bawah Rp2 juta
          </label>
          <p className="text-[11px] text-slate-400">
            Sesuai PMK 59/2022 Pasal 18, Bendahara sebenarnya TIDAK wajib memotong PPh 22 untuk transaksi
            di bawah Rp2 juta -- tapi kalau penyedia (biasanya PKP Badan Usaha) tetap minta dipotong supaya
            mereka punya Bukti Potong untuk rekonsiliasi pembukuan sendiri, itu boleh disepakati. Catatan:
            untuk PPN, penyedia yang mencantumkan PPN di bawah Rp2 juta di invoice/faktur mereka memang SAH
            (self-assessment) -- tidak perlu opsi ini, cukup jangan dipungut ulang oleh Bendahara.
          </p>
          {paksaPph22DibawahBatas && (
            <input
              type="text"
              value={alasanPaksaPph22}
              onChange={(e) => setAlasanPaksaPph22(e.target.value)}
              placeholder="Alasan/catatan untuk jejak audit-SPJ (wajib diisi)"
              className="w-full text-xs border border-amber-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
            />
          )}
        </div>

        {eKatalog && (
          <div className="flex items-start gap-2 text-xs text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 mb-3">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
              Lewat marketplace/ritel daring resmi LKPP (PMK 58/2022): marketplace itu sendiri yang DITUNJUK
              memungut &amp; menyetor PPN/PPh 22 -- <strong>kecuali</strong> kalau pembayarannya pakai mekanisme
              Pembayaran Langsung (LS), maka pemungutan tetap kembali ke Bendahara seperti biasa (perhitungan di
              bawah). Cek dulu invoice/faktur dari marketplace: kalau pajaknya sudah dipungut di sana, JANGAN
              tambahkan potongan lagi di sini (hindari pungutan ganda). Sejak pembaruan sistem pajak Katalog
              Elektronik per 16 Juli 2025, harga di "Ringkasan Pesanan"/Surat Pesanan e-katalog TIDAK LAGI
              otomatis termasuk PPN -- PPN dihitung terpisah atas total transaksi. Kalau invoice/Surat Pesanan
              yang kamu terima menunjukkan skema itu, matikan toggle "Harga sudah termasuk PPN" di bawah.
            </p>
          </div>
        )}

        {!hargaTermasukPpn && (
          <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
              Harga di Rincian Item diperlakukan sebagai harga NETTO (belum termasuk PPN). PPN akan dihitung
              MAJU (DPP x 11%) dan ditambahkan sebagai komponen Total Tagihan -- tidak memotong yang diterima
              penyedia. Pastikan barang/jasa ini memang bukan barang mewah (kalau bukan, tarif efektif PPN
              seharusnya tetap 11% lewat DPP Nilai Lain 11/12, meski tarif nominalnya disebut 12% -- PMK
              131/2024). Kalau penyedia mengenakan flat 12% untuk barang non-mewah, itu kelebihan pungut.
            </p>
          </div>
        )}

        {catatanPajak.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {catatanPajak.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <p>{c}</p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {potongan.length === 0 && (
            <p className="text-xs text-slate-400 py-2">
              Belum ada potongan. Klik "Hitung Otomatis" atau tambah manual di bawah.
            </p>
          )}
          {potongan.map((p, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                value={p.jenis_pajak}
                onChange={(e) => updatePotongan(i, { jenis_pajak: e.target.value })}
                className="col-span-6 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
              />
              <input
                type="number"
                value={p.nominal}
                onChange={(e) => updatePotongan(i, { nominal: Number(e.target.value) })}
                className="col-span-3 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
              />
              <select
                value={p.tipe ?? "potongan"}
                onChange={(e) => updatePotongan(i, { tipe: e.target.value as "potongan" | "tambahan" })}
                title="Potongan = mengurangi yang diterima penyedia. Tambahan = menambah Total Tagihan (mis. PPN atas harga netto)."
                className="col-span-2 text-xs border border-slate-200 rounded-lg px-1 py-1.5 outline-none bg-white"
              >
                <option value="potongan">Potongan</option>
                <option value="tambahan">Tambahan</option>
              </select>
              <button
                onClick={() => setPotongan(potongan.filter((_, idx) => idx !== i))}
                className="col-span-1 text-rose-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setPotongan([...potongan, { jenis_pajak: "", persentase: 0, nominal: 0, tipe: "potongan" }])}
          disabled={pajakDitanganiSistemKatalog}
          className="mt-3 text-xs flex items-center gap-1 text-emerald-600 disabled:text-slate-300 disabled:cursor-not-allowed font-medium"
        >
          <Plus className="h-3.5 w-3.5" /> Tambah potongan manual
        </button>

        {potongan.length > 0 && (() => {
          const totalTambahan = potongan
            .filter((p) => p.tipe === "tambahan")
            .reduce((s, p) => s + Number(p.nominal || 0), 0);
          const totalPotongan = potongan
            .filter((p) => p.tipe !== "tambahan")
            .reduce((s, p) => s + Number(p.nominal || 0), 0);
          const totalTagihan = totalBelanja + totalTambahan;
          const jumlahDiterima = totalTagihan - totalPotongan;
          return (
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-0.5">
              {totalTambahan > 0 && (
                <p className="text-xs text-slate-500">
                  Total Tagihan (harga + tambahan pajak): Rp {totalTagihan.toLocaleString("id-ID")}
                </p>
              )}
              <p className="text-sm font-medium text-slate-900">
                Jumlah Diterima Bersih: Rp {jumlahDiterima.toLocaleString("id-ID")}
              </p>
            </div>
          );
        })()}
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-5 py-2.5"
      >
        {saving ? "Menyimpan..." : mode === "edit" ? "Simpan Perubahan" : "Simpan Pengajuan"}
      </button>
    </div>
  );
}
