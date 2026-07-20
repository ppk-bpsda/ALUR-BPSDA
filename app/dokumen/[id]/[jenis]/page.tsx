import { buildDokumenData } from "@/lib/dokumenData";
import PrintToolbar from "./PrintToolbar";
import { notFound } from "next/navigation";

const JUDUL: Record<string, string> = {
  nota_dinas: "Nota Dinas",
  spp_sptjb: "SPP / SPTJB",
  kwitansi_gu: "Kwitansi GU",
};

export default async function DokumenPreviewPage({
  params,
}: {
  params: { id: string; jenis: string };
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

  return (
    <div className="min-h-screen bg-slate-100">
      <PrintToolbar pengajuanId={params.id} jenis={params.jenis} judul={`Pratinjau -- ${JUDUL[params.jenis]}`} />

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .doc-sheet { box-shadow: none !important; margin: 0 !important; }
        }
        @page { size: A4; margin: 18mm; }
      `}</style>

      <div className="doc-sheet max-w-[210mm] mx-auto my-6 bg-white shadow-md p-[15mm] text-[13px] leading-relaxed text-slate-900">
        {params.jenis === "nota_dinas" && <NotaDinas d={d} />}
        {params.jenis === "spp_sptjb" && <SppSptjb d={d} />}
        {params.jenis === "kwitansi_gu" && <KwitansiGu d={d} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// KOP SURAT -- hanya dipakai di Nota Dinas & SPP/SPTJB.
// Kuitansi GU sengaja TIDAK memakai kop surat (mengikuti format
// Template_Kwitansi_GU.docx yang juga tanpa kop surat).
// ---------------------------------------------------------
function KopSurat() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/assets/kop-surat.png"
      alt="Kop Surat"
      className="w-full h-auto mb-4"
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
          <Baris label="Kepada" value={`Kuasa Pengguna Anggaran ${d.nama_skpd}`} />
          <Baris label="Dari" value={`Pejabat Pelaksana Teknis Kegiatan ${d.nama_skpd}`} />
          <Baris label="Hari/Tanggal" value={d.hari_tanggal} />
          <Baris label="Nomor" value={d.nomor_nota_dinas} />
          <Baris label="Sifat" value="Penting" />
          <Baris label="Lampiran" value="-" />
          <Baris label="Perihal" value={`Pengajuan Pencairan ${d.jenis_pencairan}`} />
        </tbody>
      </table>

      <p className="mb-4">
        Bersama ini kami menyampaikan dengan hormat Pengajuan Pencairan Anggaran kegiatan pada {d.nama_skpd}{" "}
        dengan rincian sebagai berikut:
      </p>

      <table className="w-full border border-slate-400 border-collapse mb-4 text-xs">
        <thead>
          <tr className="bg-slate-50">
            {["No", "Uraian", "Kode Rek.", "Jenis Belanja", "Sumber Dana", "Pagu", "Realisasi Sblm", "Ajuan Skrg", "Sisa"].map((h) => (
              <th key={h} className="border border-slate-400 px-2 py-1 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-400 px-2 py-1 align-top" rowSpan={2}>1</td>
            <td className="border border-slate-400 px-2 py-1 align-top" colSpan={8}>
              <p className="font-semibold">{d.program_nama}</p>
              <p>Kegiatan {d.kegiatan_nama}</p>
              <p>Sub Kegiatan {d.sub_kegiatan_nama} ({d.kode_sub_kegiatan})</p>
            </td>
          </tr>
          <tr>
            <td className="border border-slate-400 px-2 py-1 align-top">Belanja {d.jenis_belanja}</td>
            <td className="border border-slate-400 px-2 py-1 align-top">{d.kode_rekening}</td>
            <td className="border border-slate-400 px-2 py-1 align-top">{d.kelompok_belanja}</td>
            <td className="border border-slate-400 px-2 py-1 align-top">{d.sumber_dana}</td>
            <td className="border border-slate-400 px-2 py-1 align-top text-right">{d.pagu_anggaran}</td>
            <td className="border border-slate-400 px-2 py-1 align-top text-right">{d.realisasi_sebelum}</td>
            <td className="border border-slate-400 px-2 py-1 align-top text-right">{d.jumlah_pengajuan}</td>
            <td className="border border-slate-400 px-2 py-1 align-top text-right">{d.sisa_anggaran}</td>
          </tr>
          <tr>
            <td className="border border-slate-400 px-2 py-1"></td>
            <td className="border border-slate-400 px-2 py-1 font-semibold" colSpan={8}>
              Rincian sebagai berikut:
            </td>
          </tr>
          {(d.rincian ?? []).map((r: any, i: number) => (
            <tr key={i}>
              <td className="border border-slate-400 px-2 py-1"></td>
              <td className="border border-slate-400 px-2 py-1" colSpan={7}>
                Belanja {d.jenis_belanja} -- {r.uraian_kegiatan}
              </td>
              <td className="border border-slate-400 px-2 py-1 text-right">{r.jumlah_pengajuan}</td>
            </tr>
          ))}
          <tr>
            <td className="border border-slate-400 px-2 py-1"></td>
            <td className="border border-slate-400 px-2 py-1 font-bold" colSpan={7}>TOTAL PENGAJUAN</td>
            <td className="border border-slate-400 px-2 py-1 text-right font-bold">{d.total_pengajuan}</td>
          </tr>
        </tbody>
      </table>

      <p className="mb-10">Demikian nota dinas ini disampaikan untuk menjadi periksa.</p>

      <div className="flex justify-end">
        <div className="text-center w-64">
          <p>Batu, {d.tanggal_surat}</p>
          <p className="font-semibold mt-1">PEJABAT PELAKSANA TEKNIS KEGIATAN</p>
          <div className="h-16" />
          <p className="underline font-medium">{d.nama_pptk}</p>
          <p>{d.pangkat_pptk}</p>
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
            value={`Pejabat Pelaksana Teknis Kegiatan ${d.nama_sub_kegiatan} berdasarkan SK Kuasa Pengguna Anggaran Nomor: ${d.nomor_sk_kpa} tentang Penunjukan Penanggung Jawab Pengelola Keuangan Pada ${d.nama_skpd} Tahun Anggaran ${d.tahun_anggaran}.`}
            noWidth
          />
        </tbody>
      </table>

      <p className="mb-4">
        Sehubungan dengan pembelanjaan yang kami lakukan sebesar Rp. {d.jumlah_pengajuan_angka},00 (
        {d.jumlah_pengajuan_terbilang}), untuk Perhitungan yang terdapat pada Pengajuan Pembayaran GU{" "}
        {d.uraian_kegiatan} Kegiatan {d.nama_kegiatan} Sub Kegiatan {d.nama_sub_kegiatan} dengan ini menyatakan
        dengan sebenarnya bahwa:
      </p>

      <ol className="list-decimal pl-5 space-y-2 mb-6">
        <li>
          Jumlah pembelanjaan tersebut di atas benar-benar dipergunakan sesuai DPA {d.tahapan_dpa}-SKPD, untuk
          keperluan {d.jenis_belanja} Kode Rekening {d.kode_rekening_lengkap}.
        </li>
        <li>
          Pembelanjaan tersebut benar-benar dipergunakan untuk pelaksanaan Kegiatan {d.nama_kegiatan} Sub
          Kegiatan {d.nama_sub_kegiatan}.
        </li>
        <li>Bertanggung jawab atas pembelanjaan yang terjadi.</li>
      </ol>

      <p className="mb-10">
        Demikian Surat Pernyataan ini dibuat untuk melengkapi pertanggungjawaban atas penggunaan anggaran yang
        dipercayakan kepada kami.
      </p>

      <div className="flex justify-end">
        <div className="text-center w-64">
          <p>Batu, {d.tanggal_surat}</p>
          <p className="font-semibold mt-1">PEJABAT PELAKSANA TEKNIS KEGIATAN (PPTK),</p>
          <div className="h-16" />
          <p className="underline font-medium">{d.nama_pptk}</p>
          <p>NIP. {d.nip_pptk}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// KWITANSI GU -- mengikuti format persis yang dilampirkan
// ---------------------------------------------------------
function KwitansiGu({ d }: { d: any }) {
  return (
    <div>
      <table className="w-full mb-6">
        <tbody>
          <tr>
            <td className="w-1/2"></td>
            <td className="w-40 align-top">TA</td>
            <td className="w-4 align-top">:</td>
            <td className="align-top">{d.tahun_anggaran}</td>
          </tr>
          <tr>
            <td></td>
            <td className="align-top">Nomor Bukti</td>
            <td className="align-top">:</td>
            <td className="align-top">{d.nomor_bukti}</td>
          </tr>
          <tr>
            <td></td>
            <td className="align-top">Kode Rekening</td>
            <td className="align-top">:</td>
            <td className="align-top">{d.kode_rekening_lengkap}</td>
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

      <p className="mb-1">{d.uraian_kegiatan_lengkap} dengan rincian:</p>
      <div className="mb-4">
        {(d.rincian ?? []).map((r: any, i: number) => (
          <p key={i}>
            - {r.nama_item} {r.qty} {r.satuan} x {r.harga_satuan} = {r.subtotal}
          </p>
        ))}
      </div>

      <p className="font-bold mb-1">Potongan</p>
      <table className="w-full mb-1">
        <tbody>
          {(d.potongan ?? []).length === 0 && (
            <tr>
              <td className="w-40 py-0.5">-- Tidak ada potongan --</td>
              <td className="w-4 py-0.5"></td>
              <td className="py-0.5"></td>
            </tr>
          )}
          {(d.potongan ?? []).map((p: any, i: number) => (
            <Baris key={i} label={p.jenis_pajak} value={`Rp. ${p.nominal}`} />
          ))}
          <Baris label={<b>Jumlah Potongan</b>} value={<b>Rp. {d.total_potongan}</b>} />
        </tbody>
      </table>

      <table className="w-full mb-10">
        <tbody>
          <Baris label={<b>Jumlah diterima</b>} value={<b>Rp. {d.jumlah_diterima}</b>} />
        </tbody>
      </table>

      <div className="flex justify-end mb-10">
        <div className="text-center w-64">
          <p>Batu, {d.tanggal_surat}</p>
          <p>Penerima</p>
          <div className="h-16" />
          <p>( {d.nama_penerima} )</p>
        </div>
      </div>

      <table className="w-full text-center border-t border-slate-400 pt-4">
        <thead>
          <tr>
            <td className="pt-4">Setuju Dibayar</td>
            <td className="pt-4">Menyetujui,</td>
            <td className="pt-4 font-bold">Setuju dan Lunas Dibayar</td>
          </tr>
          <tr>
            <td className="pb-2">Kuasa Pengguna Anggaran</td>
            <td className="pb-2">Pejabat Pelaksana Teknis Kegiatan</td>
            <td className="pb-2">Bendahara Pengeluaran Pembantu</td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="h-16 align-bottom underline">{d.nama_kpa}</td>
            <td className="h-16 align-bottom underline">{d.nama_pptk}</td>
            <td className="h-16 align-bottom underline">{d.nama_bendahara}</td>
          </tr>
          <tr>
            <td>NIP. {d.nip_kpa}</td>
            <td>NIP. {d.nip_pptk}</td>
            <td>NIP. {d.nip_bendahara}</td>
          </tr>
        </tbody>
      </table>
    </div>
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
