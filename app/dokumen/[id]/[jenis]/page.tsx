import { buildDokumenData } from "@/lib/dokumenData";
import PrintToolbar from "./PrintToolbar";
import { notFound } from "next/navigation";

// PENTING -- lihat catatan yang sama di app/api/generate-dokumen/route.ts:
// tanpa ini, Next.js bisa menyajikan versi cache dari halaman pratinjau ini,
// sehingga "Realisasi Sblm" / "Sisa" tidak ikut ter-update walau status
// pengajuan sebelumnya (di rekening yang sama) sudah diubah jadi
// disetujui/dicairkan.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const JUDUL: Record<string, string> = {
  nota_dinas: "Nota Dinas",
  spp_sptjb: "SPP / SPTJB",
  kwitansi_gu: "Kuitansi",
};

export default async function DokumenPreviewPage({
  params,
  searchParams,
}: {
  params: { id: string; jenis: string };
  searchParams: { orientasi?: string };
}) {
  if (!JUDUL[params.jenis]) return notFound();

  let d;
  try {
    d = await buildDokumenData(params.id);
  } catch (e: any) {
    return (
      <div className="p-8 text-sm text-rose-600">
        Gagal memuat dokumen: {e.message || "Pengajuan tidak ditemukan."}
      </div>
    );
  }

  // Margin dokumen: atas 1,5cm / kiri 2,5cm / bawah 2cm / kanan 2cm --
  // berlaku sama untuk pratinjau layar, cetak langsung ke printer, maupun
  // "Save as PDF" (satu sumber CSS yang sama untuk ketiganya, supaya tidak
  // ada selisih ukuran antar cara cetak).
  const orientasi = searchParams.orientasi === "landscape" ? "landscape" : "portrait";
  const isLandscape = orientasi === "landscape";
  const marginCss = "15mm 20mm 20mm 25mm"; // top right bottom left
  const lebarKertas = isLandscape ? "297mm" : "210mm";

  return (
    <div className="min-h-screen bg-slate-100">
      <PrintToolbar
        pengajuanId={params.id}
        jenis={params.jenis}
        judul={`Pratinjau -- ${JUDUL[params.jenis]}`}
        orientasi={orientasi}
      />

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .doc-sheet {
            box-shadow: none !important;
            margin: 0 !important;
            /* PENTING: @page di bawah ini SUDAH menerapkan margin
               ${marginCss} pada area cetak. Kalau .doc-sheet masih
               dipaksa width: ${lebarKertas} + padding: ${marginCss} juga
               (seperti dipakai untuk pratinjau di layar), lebar kontennya
               jadi lebih besar dari area cetak yang tersisa -> konten
               melebar ke kanan -> Chrome/browser otomatis MENGECILKAN
               (scale) seluruh halaman supaya tetap muat 1 halaman.
               Itu sebabnya hasil cetak/Save PDF turun dari 100%.
               Untuk cetak/PDF, biarkan .doc-sheet mengikuti area cetak
               @page apa adanya (width auto, padding 0) -- margin visualnya
               sudah otomatis didapat dari @page margin di bawah. */
            width: auto !important;
            max-width: none !important;
            padding: 0 !important;
          }
        }
        /* Atas 1,5cm, kiri 2,5cm, bawah 2cm, kanan 2cm -- sama persis
           dengan margin di template .docx (templates/) supaya hasil
           Unduh Word dan hasil cetak/PDF dari sini tidak berselisih. */
        @page { size: A4 ${orientasi}; margin: ${marginCss}; }
        .doc-sheet table { table-layout: auto; width: 100%; }
        .doc-sheet td, .doc-sheet th { word-break: break-word; }
      `}</style>

      <div
        className="doc-sheet mx-auto my-6 bg-white shadow-md text-slate-900"
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "11pt",
          lineHeight: 1.25,
          padding: marginCss,
          width: lebarKertas,
          maxWidth: lebarKertas,
        }}
      >
        {params.jenis === "nota_dinas" && <NotaDinas d={d} />}
        {params.jenis === "spp_sptjb" && <SppSptjb d={d} />}
        {params.jenis === "kwitansi_gu" && <KwitansiGu d={d} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// KOP SURAT -- HANYA dipakai di Nota Dinas & SPP/SPTJB.
// Kuitansi (LS maupun GU) sengaja TIDAK memakai kop surat.
// Diletakkan sebagai elemen PALING ATAS (sebelum judul dokumen)
// di dalam div.doc-sheet, supaya posisinya identik dengan kop
// surat yang ada di baris pertama Template_Nota_Dinas.docx /
// Template_SPP_SPTJB.docx.
// ---------------------------------------------------------
function KopSurat() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/assets/kop-surat.png"
      alt="Kop Surat Pemerintah Kota Batu"
      className="block w-full h-auto mb-4"
    />
  );
}

// ---------------------------------------------------------
// NOTA DINAS
// ---------------------------------------------------------
function NotaDinas({ d }: { d: any }) {
  return (
    <div>
      <KopSurat />
      <h1 className="text-center font-bold text-base underline mb-6">NOTA DINAS</h1>

      <table className="w-full mb-4">
        <tbody>
          <Baris label="Kepada" value={`Kuasa Pengguna Anggaran ${d.skpd}`} />
          <Baris label="Dari" value={`Pejabat Pelaksana Teknis Kegiatan ${d.skpd}`} />
          <Baris label="Hari/Tanggal" value={d.hari_tanggal} />
          <Baris label="Nomor" value={d.nomor_nota_dinas} />
          <Baris label="Sifat" value="Penting" />
          <Baris label="Lampiran" value="-" />
          <Baris label="Perihal" value={`Pengajuan Pencairan ${d.metode_pembayaran}`} />
        </tbody>
      </table>

      <p className="mb-4 text-justify">
        Bersama ini kami menyampaikan dengan hormat Pengajuan Pencairan Anggaran kegiatan pada {d.skpd} dengan
        rincian sebagai berikut :
      </p>

      {/* Tabel rincian PROGRAM/Kegiatan/Sub Kegiatan/dst -- format baru
          sesuai lampiran (2 kolom berbingkai, tanpa tanda ':'). */}
      <table className="w-full border border-slate-400 border-collapse mb-4 text-sm">
        <tbody>
          <RincianBaris label="PROGRAM" value={d.program} />
          <RincianBaris label="Kegiatan" value={d.kegiatan} />
          <RincianBaris label="Sub Kegiatan" value={d.sub_kegiatan} />
          <RincianBaris label="Belanja" value={d.belanja} />
          <RincianBaris label="Kode Rekening" value={d.kode_rekening_lengkap} />
          <RincianBaris label="Jenis Belanja" value={d.jenis_belanja} />
          <RincianBaris label="Rincian Belanja" value={d.uraian_belanja_lengkap} />
        </tbody>
      </table>

      <table className="w-full border border-slate-400 border-collapse mb-4 text-sm">
        <thead>
          <tr className="bg-slate-50 text-center font-semibold">
            <th className="border border-slate-400 px-2 py-1.5">Sumber Dana</th>
            <th className="border border-slate-400 px-2 py-1.5">Pagu</th>
            <th className="border border-slate-400 px-2 py-1.5">Realisasi Sebelum</th>
            <th className="border border-slate-400 px-2 py-1.5">Ajuan Sekarang</th>
            <th className="border border-slate-400 px-2 py-1.5">Sisa</th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-center">
            <td className="border border-slate-400 px-2 py-1.5">{d.sumber_dana}</td>
            <td className="border border-slate-400 px-2 py-1.5">{d.pagu}</td>
            <td className="border border-slate-400 px-2 py-1.5">{d.realisasi_sblm}</td>
            <td className="border border-slate-400 px-2 py-1.5">{d.ajuan_skrg}</td>
            <td className="border border-slate-400 px-2 py-1.5">{d.sisa}</td>
          </tr>
          <tr>
            <td className="border border-slate-400 px-2 py-1.5 font-bold text-center" colSpan={3}>
              Total Pengajuan
            </td>
            <td className="border border-slate-400 px-2 py-1.5 font-bold text-center">{d.ajuan_skrg}</td>
            <td className="border border-slate-400 px-2 py-1.5"></td>
          </tr>
        </tbody>
      </table>

      <p className="mb-10">Demikian nota dinas ini disampaikan untuk menjadi periksa.</p>

      <div className="flex justify-end">
        <div className="text-left w-64">
          <p className="font-semibold">PEJABAT PELAKSANA TEKNIS KEGIATAN</p>
          <div className="h-16" />
          <p className="font-medium">{d.nama_pptk}.</p>
          <p>NIP. {d.nip_pptk}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// SPP / SPTJB
// ---------------------------------------------------------
function SppSptjb({ d }: { d: any }) {
  return (
    <div>
      <KopSurat />
      <h1 className="text-center font-bold text-base underline mb-6">SURAT PERNYATAAN TANGGUNG JAWAB BELANJA</h1>

      <table className="mb-4">
        <tbody>
          <Baris label="Nama" value={d.nama_pptk} noWidth />
          <Baris label="NIP" value={d.nip_pptk} noWidth />
          <Baris
            label="Jabatan"
            value={`Pejabat Pelaksana Teknis Kegiatan ${d.nama_kegiatan} berdasarkan SK Kuasa Pengguna Anggaran Nomor: ${d.nomor_sk_kpa} tentang Penunjukan Penanggung Jawab Pengelola Keuangan Pada ${d.nama_skpd} Tahun Anggaran ${d.tahun_anggaran}.`}
            noWidth
          />
        </tbody>
      </table>

      <p className="mb-4 text-justify">
        Sehubungan dengan pembelanjaan yang kami lakukan sebesar Rp. {d.jumlah_pengajuan_angka},00 (
        {d.jumlah_pengajuan_terbilang}), untuk Perhitungan yang terdapat pada Pengajuan Pembayaran {d.metode_pembayaran}{" "}
        {d.uraian_kegiatan} Kegiatan {d.nama_kegiatan} Sub Kegiatan {d.nama_sub_kegiatan} dengan ini menyatakan
        dengan sebenarnya bahwa:
      </p>

      <ol className="list-decimal pl-5 space-y-2 mb-6 text-justify">
        <li>
          Jumlah pembelanjaan tersebut di atas benar-benar dipergunakan sesuai DPA {d.tahapan_dpa} {d.nama_skpd}, untuk
          keperluan {d.jenis_belanja} Kode Rekening {d.kode_rekening_lengkap}.
        </li>
        <li>
          Pembelanjaan tersebut benar-benar dipergunakan untuk Kegiatan {d.nama_kegiatan} Sub
          Kegiatan {d.nama_sub_kegiatan}.
        </li>
        <li>Bertanggung jawab atas pembelanjaan yang terjadi.</li>
      </ol>

      <p className="mb-10 text-justify">
        Demikian Surat Pernyataan ini dibuat untuk melengkapi pertanggungjawaban atas penggunaan anggaran yang
        dipercayakan kepada kami.
      </p>

      <div className="flex justify-end">
        <div className="text-left w-64">
          <p className="font-semibold">PEJABAT PELAKSANA TEKNIS KEGIATAN (PPTK),</p>
          <div className="h-16" />
          <p className="font-medium">{d.nama_pptk}</p>
          <p>NIP. {d.nip_pptk}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// KUITANSI (LS maupun GU) -- mengikuti format persis yang dilampirkan
// ---------------------------------------------------------
function KwitansiGu({ d }: { d: any }) {
  return (
    <div>
      {/* TA / Nomor Bukti / Kode Rekening -- font 10pt. Tanda ':' pada
          ketiga baris LURUS (kolom label lebar tetap, acuan baris Kode
          Rekening), nilai (2026 / - / kode rekening) ditulis 2 ketukan
          spasi SETELAH ':', dan kode rekening dipaksa 1 baris. */}
      <table className="w-full mb-6">
        <tbody>
          <tr>
            <td className="w-1/2"></td>
            <td colSpan={2} className="align-top p-0">
              <table className="w-full">
                <tbody>
                  <BarisKuitansi label="TA" value={d.tahun_anggaran} />
                  <BarisKuitansi label="Nomor Bukti" value={d.nomor_bukti} />
                  <BarisKuitansi label="Kode Rekening" value={d.kode_rekening_lengkap} />
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      <h1 className="text-center font-bold text-base mb-6">KWITANSI / BUKTI PEMBAYARAN</h1>

      <table className="w-full mb-4">
        <tbody>
          <Baris label="Sudah terima dari" value="PEMERINTAH KOTA BATU" />
          <tr>
            <td className="w-40 align-top py-0.5">SKPD</td>
            <td className="w-4 align-top py-0.5">:</td>
            <td className="align-top py-0.5 whitespace-pre-line text-left">{d.nama_skpd_2baris}</td>
          </tr>
        </tbody>
      </table>

      <table className="w-full mb-4">
        <tbody>
          <Baris label="Jumlah Uang" value={<b>Rp. {d.jumlah_uang},00</b>} />
          <Baris label="Terbilang" value={d.jumlah_uang_terbilang} />
          <Baris label="Untuk Pembayaran" value={d.jenis_belanja} />
        </tbody>
      </table>

      {/* Uraian & rincian item -- posisinya SENGAJA dibuat lurus/sejajar
          dengan kolom nilai di atas (kolom tempat "PEMERINTAH KOTA BATU"
          / "Rp" berada), bukan menempel ke tepi kiri kertas. */}
      <table className="w-full mb-4">
        <tbody>
          <tr>
            <td className="w-40 align-top py-0.5"></td>
            <td className="w-4 align-top py-0.5"></td>
            <td className="align-top py-0.5">{d.uraian_kegiatan_lengkap} dengan rincian :</td>
          </tr>
          {(d.rincian ?? []).map((r: any, i: number) => (
            <tr key={i}>
              <td></td>
              <td></td>
              <td className="align-top py-0.5">
                - {r.nama_item} {r.qty} {r.satuan} x Rp {r.harga_satuan} = Rp {r.subtotal}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Potongan s/d Jumlah Diterima -- font 10pt. Tanda ':' LURUS,
          acuan baris "Pajak Daerah 10%" (label terpanjang di blok ini),
          nilai ditulis 2 ketukan spasi SETELAH ':'. */}
      <p className="font-bold mb-1" style={{ fontSize: "10pt" }}>Potongan</p>
      <table className="w-full mb-1">
        <tbody>
          {/* 6 slot tetap sesuai lampiran Kwitansi GU -- selalu tampil, Rp 0 kalau tidak relevan */}
          <BarisKuitansi label="PPN" value={`Rp. ${d.potongan_ppn}`} />
          <BarisKuitansi label="Pajak Daerah 10%" value={`Rp. ${d.potongan_pajak_daerah}`} />
          <BarisKuitansi label="PPh 21 0,5%" value={`Rp. ${d.potongan_pph21_05}`} />
          <BarisKuitansi label="PPh 21 2,5%" value={`Rp. ${d.potongan_pph21_25}`} />
          <BarisKuitansi label="PPh 22 1,5%" value={`Rp. ${d.potongan_pph22_15}`} />
          <BarisKuitansi label="PPh 23 2%" value={`Rp. ${d.potongan_pph23_2}`} />
          {(d.potongan_lainnya ?? []).map((p: any, i: number) => (
            <BarisKuitansi key={i} label={p.jenis_pajak} value={`Rp. ${p.nominal}`} />
          ))}
          <BarisKuitansi label="Jumlah Potongan" value={`Rp. ${d.total_potongan}`} bold />
        </tbody>
      </table>

      <table className="w-full mb-10">
        <tbody>
          <BarisKuitansi label="Jumlah diterima" value={`Rp. ${d.jumlah_diterima}`} bold />
        </tbody>
      </table>

      {/* Blok tanda tangan Penerima -- OPSIONAL, dikontrol dari Form
          Pengajuan Belanja (checkbox "Cetak blok tanda tangan Penerima"). */}
      {d.cetak_ttd_penerima && (
        <div className="grid grid-cols-3 mb-10">
          <div />
          <div />
          <div className="text-left">
            <p>Batu, {d.tanggal_surat}</p>
            <p>Penerima</p>
            <div className="h-16" />
            <p>( {d.nama_penerima} )</p>
          </div>
        </div>
      )}

      <table className="w-full text-left border-t border-slate-400 pt-4">
        <thead>
          <tr>
            <td className="pt-4">Setuju Dibayar</td>
            <td className="pt-4">Menyetujui,</td>
            <td className="pt-4 font-bold">Setuju dan Lunas Dibayar</td>
          </tr>
          <tr>
            {/* Tanggal pencairan diisi MANUAL oleh Bendahara saat kuitansi
                benar-benar dibayar (bisa berbeda dari tanggal Nota Dinas) --
                hanya muncul di kolom Bendahara, ditulis titik-titik. */}
            <td></td>
            <td></td>
            <td className="pb-1">Batu, ……………………………</td>
          </tr>
          <tr>
            <td className="pb-2 whitespace-nowrap">Kuasa Pengguna Anggaran</td>
            <td className="pb-2 whitespace-nowrap">Pejabat Pelaksana Teknis Kegiatan</td>
            <td className="pb-2 whitespace-nowrap">Bendahara Pengeluaran Pembantu</td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="h-16 align-bottom whitespace-nowrap">{d.nama_kpa}</td>
            <td className="h-16 align-bottom whitespace-nowrap">{d.nama_pptk}</td>
            <td className="h-16 align-bottom whitespace-nowrap">{d.nama_bendahara}</td>
          </tr>
          <tr>
            <td className="whitespace-nowrap">NIP. {d.nip_kpa}</td>
            <td className="whitespace-nowrap">NIP. {d.nip_pptk}</td>
            <td className="whitespace-nowrap">NIP. {d.nip_bendahara}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Baris tabel berbingkai 2 kolom (label | value) TANPA tanda ':' -- dipakai
// di blok PROGRAM/Kegiatan/Sub Kegiatan/dst pada format Nota Dinas terbaru.
function RincianBaris({ label, value }: { label: any; value: any }) {
  return (
    <tr>
      <td className="border border-slate-400 px-2 py-1.5 font-medium align-top w-1/3">{label}</td>
      <td className="border border-slate-400 px-2 py-1.5 align-top">{value}</td>
    </tr>
  );
}

function Baris({ label, value, noWidth }: { label: any; value: any; noWidth?: boolean }) {
  return (
    <tr>
      <td className={`${noWidth ? "w-24" : "w-40"} align-top py-0.5`}>{label}</td>
      <td className="w-4 align-top py-0.5">:</td>
      <td className="align-top py-0.5">{value}</td>
    </tr>
  );
}

// Varian baris label/':'/nilai KHUSUS Kuitansi: label rata kiri dengan jarak
// 2 ketukan spasi sebelum tanda ':' (bukan ':' menempel di kolom sendiri),
// dan bisa diberi ukuran font berbeda (dipakai untuk blok TA s/d Kode
// Rekening dan Potongan s/d Jumlah Diterima -- 10pt sesuai permintaan).
function BarisKuitansi({
  label, value, bold, fontSizePt = 10,
}: {
  label: any; value: any; bold?: boolean; fontSizePt?: number;
}) {
  const Wrap = bold ? "b" : "span" as any;
  // Label & ':' dipisah jadi kolom sendiri-sendiri (lebar label TETAP,
  // sama untuk semua baris dalam satu blok) supaya tanda ':' selalu LURUS
  // vertikal, baik di blok TA/Nomor Bukti/Kode Rekening maupun di blok
  // Potongan s/d Jumlah Diterima -- acuan lurusnya adalah baris berlabel
  // terpanjang di masing-masing blok (Kode Rekening / Pajak Daerah 10%).
  // Nilai (2026, -, kode rekening, dst) ditulis 2 ketukan spasi SETELAH
  // ':', dan kode rekening dipaksa tetap 1 baris (whitespace-nowrap).
  return (
    <tr style={{ fontSize: `${fontSizePt}pt` }}>
      <td className="w-44 align-top py-0.5 whitespace-nowrap">
        <Wrap>{label}</Wrap>
      </td>
      <td className="align-top py-0.5 whitespace-nowrap" style={{ width: "4mm" }}>
        <Wrap>:</Wrap>
      </td>
      <td className="align-top py-0.5 whitespace-nowrap">
        <Wrap>&nbsp;&nbsp;{value}</Wrap>
      </td>
    </tr>
  );
}
