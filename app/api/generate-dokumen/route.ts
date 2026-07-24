import { NextRequest, NextResponse } from "next/server";
import { renderTemplate } from "@/lib/renderTemplate";
import { buildDokumenData } from "@/lib/dokumenData";

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

  let dataUmum;
  try {
    dataUmum = await buildDokumenData(pengajuanId);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Pengajuan tidak ditemukan." }, { status: 404 });
  }

  try {
    const buffer = renderTemplate(TEMPLATE_FILE[jenis], dataUmum);
    const filenameMap: Record<string, string> = {
      nota_dinas: "Nota_Dinas",
      spp_sptjb: "SPP_SPTJB",
      kwitansi_gu: "Kuitansi",
    };
    const filename = `${filenameMap[jenis]}_${dataUmum.tanggal}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        // "attachment" di sini disengaja -- endpoint ini sekarang dipanggil
        // dari tombol "Unduh Word (.docx)" di halaman pratinjau, bukan
        // langsung dari daftar Pengajuan Belanja lagi. Pratinjau + cetak
        // utamanya lewat halaman /pengajuan/[id]/dokumen/[jenis].
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
