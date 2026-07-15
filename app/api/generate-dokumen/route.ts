import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { renderTemplate } from "@/lib/renderTemplate";
import { terbilang, formatRupiah } from "@/lib/terbilang";
import { formatTanggalSurat, formatHariTanggal } from "@/lib/format";

const NAMA_SKPD =
  process.env.NEXT_PUBLIC_NAMA_SKPD ||
  "Sekretariat Daerah - Bagian Perekonomian dan Sumber Daya Alam";

const TEMPLATE_FILE: Record<string, string> = {
  nota_dinas: "Template_Nota_Dinas.docx",
  spp_sptjb: "Template_SPP_SPTJB.docx",
  kwitansi_gu: "Template_Kwitansi_GU.docx",
};

export async function GET(req: NextRequest) {
  const pengajuanId = req.nextUrl.searchParams.get("pengajuan_id");
  const jenis = req.nextUrl.searchParams.get("jenis") as keyof typeof TEMPLATE_FILE | null;

  if (!pengajuanId || !jenis || !TEMPLATE_FILE[jenis]) {
    return NextResponse.json({ error: "Parameter pengajuan_id / jenis tidak valid." }, { status: 400 });
  }

  // Pakai service_role di server -- tidak terikat sesi/cookie user, aman di API route.
  const supabase = createServiceClient();

  const { data: pengajuan, error } = await supabase
    .from("pengajuan_belanja")
    .select(
      `
      id, nomor_bukti, nomor_nota_dinas, tanggal, uraian_kegiatan, jumlah_pengajuan,
      penerima:penerima(nama_penerima),
      penyedia:penyedia(nama_penyedia, nama_direktur, alamat, npwp, rekening_bank),
      dpa:dpa (
        tahun_anggaran, tahapan, pagu_anggaran, nomor_dpa,
        pptk:pptk(nama, nip, nomor_sk),
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
    return NextResponse.json({ error: error?.message || "Pengajuan tidak ditemukan." }, { status: 404 });
  }

  const { data: rincianRows } = await supabase
    .from("rincian_belanja")
    .select("*")
    .eq("pengajuan_id", pengajuanId);

  const { data: potonganRows } = await supabase
    .from("potongan_pajak")
    .select("*")
    .eq("pengajuan_id", pengajuanId);

  const tahunAnggaran: number = (pengajuan as any).dpa?.tahun_anggaran ?? new Date().getFullYear();
  const { data: kpaRow } = await supabase
    .from("pejabat_skpd")
    .select("nama, nip")
    .eq("jabatan", "KPA")
    .eq("tahun_anggaran", tahunAnggaran)
    .maybeSingle();
  const { data: bppRow } = await supabase
    .from("pejabat_skpd")
    .select("nama, nip")
    .eq("jabatan", "BENDAHARA_PENGELUARAN_PEMBANTU")
    .eq("tahun_anggaran", tahunAnggaran)
    .maybeSingle();

  const dpa: any = (pengajuan as any).dpa;
  const rekening = dpa?.rekening;
  const subKeg = rekening?.sub_kegiatan;
  const kegiatan = subKeg?.kegiatan;
  const program = kegiatan?.program;
  const pptk = dpa?.pptk;

  const kodeRekeningLengkap = `${subKeg?.kode_sub_kegiatan}.${rekening?.kode_rekening}`;

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

  function cariPotongan(label: string) {
    const row = (potonganRows ?? []).find((p: any) => p.jenis_pajak === label);
    return row ? Number(row.nominal) : 0;
  }
  const potonganPajakDaerah = cariPotongan("Pajak Daerah 10%");
  const potonganPphFinal = cariPotongan("PPH Final");
  const potonganPph22 = cariPotongan("PPH 22 (1,5%)");
  const potonganPph23 = cariPotongan("PPH 23 (2%)");
  const totalPotongan = potonganPajakDaerah + potonganPphFinal + potonganPph22 + potonganPph23;
  const jumlahDiterima = Number(pengajuan.jumlah_pengajuan) - totalPotongan;

  const dataUmum = {
    nama_skpd: NAMA_SKPD,
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
    realisasi_sebelum: formatRupiah(0),
    sisa_anggaran: formatRupiah((dpa?.pagu_anggaran || 0) - pengajuan.jumlah_pengajuan),
    nomor_nota_dinas: pengajuan.nomor_nota_dinas || "-",
    nomor_bukti: pengajuan.nomor_bukti || "-",
    hari_tanggal: formatHariTanggal(pengajuan.tanggal),
    tanggal_surat: formatTanggalSurat(pengajuan.tanggal),
    jenis_pencairan: "GU",

    nama_pptk: pptk?.nama || "-",
    pangkat_pptk: "",
    nip_pptk: pptk?.nip || "-",
    nomor_sk_kpa: pptk?.nomor_sk || "-",

    nama_kpa: kpaRow?.nama || "-",
    nip_kpa: kpaRow?.nip || "-",
    nama_bendahara: bppRow?.nama || "-",
    nip_bendahara: bppRow?.nip || "-",

    nama_penerima: (pengajuan as any).penerima?.nama_penerima || "-",

    jumlah_pengajuan_angka: formatRupiah(pengajuan.jumlah_pengajuan),
    jumlah_pengajuan_terbilang: terbilang(Number(pengajuan.jumlah_pengajuan)),
    jumlah_uang: formatRupiah(pengajuan.jumlah_pengajuan),
    jumlah_uang_terbilang: terbilang(Number(pengajuan.jumlah_pengajuan)),

    potongan_pajak_daerah: formatRupiah(potonganPajakDaerah),
    potongan_pph_final: formatRupiah(potonganPphFinal),
    potongan_pph22: formatRupiah(potonganPph22),
    potongan_pph23: formatRupiah(potonganPph23),
    total_potongan: formatRupiah(totalPotongan),
    jumlah_diterima: formatRupiah(jumlahDiterima),

    rincian,
  };

  try {
    const buffer = renderTemplate(TEMPLATE_FILE[jenis], dataUmum);
    const filenameMap: Record<string, string> = {
      nota_dinas: "Nota_Dinas",
      spp_sptjb: "SPP_SPTJB",
      kwitansi_gu: "Kwitansi_GU",
    };
    const filename = `${filenameMap[jenis]}_${pengajuan.tanggal}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Gagal membuat dokumen. Cek kelengkapan data.", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
