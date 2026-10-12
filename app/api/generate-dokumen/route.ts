import { NextRequest, NextResponse } from "next/server";
import { renderTemplate } from "@/lib/renderTemplate";
import { buildDokumenData } from "@/lib/dokumenData";
import { requireUser, isUuid } from "@/lib/auth";

// PENTING: route ini menghitung "Realisasi Sblm" & "Sisa" dari data
// pengajuan_belanja TERBARU (lihat lib/dokumenData.ts). force-dynamic
// memastikan route ini SELALU dieksekusi ulang dan TIDAK memakai cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const TEMPLATE_FILE = {
  nota_dinas: "Template_Nota_Dinas.docx",
  spp_sptjb: "Template_SPP_SPTJB.docx",
  kwitansi_gu: "Template_Kwitansi_GU.docx",
} as const;

const FILENAME_PREFIX = {
  nota_dinas: "Nota_Dinas",
  spp_sptjb: "SPP_SPTJB",
  kwitansi_gu: "Kuitansi",
} as const;

type Jenis = keyof typeof TEMPLATE_FILE;

export async function GET(req: NextRequest) {
  // Endpoint ini memakai service_role di baliknya (buildDokumenData) --
  // WAJIB login. Sebelumnya terbuka untuk siapa pun yang tahu/menebak ID.
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const pengajuanId = req.nextUrl.searchParams.get("pengajuan_id");
  const jenisRaw = req.nextUrl.searchParams.get("jenis") ?? "";

  if (!isUuid(pengajuanId) || !Object.prototype.hasOwnProperty.call(TEMPLATE_FILE, jenisRaw)) {
    return NextResponse.json({ error: "Parameter pengajuan_id / jenis tidak valid." }, { status: 400 });
  }
  const jenis = jenisRaw as Jenis;

  let dataUmum;
  try {
    dataUmum = await buildDokumenData(pengajuanId);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Pengajuan tidak ditemukan." }, { status: 404 });
  }

  try {
    const buffer = renderTemplate(TEMPLATE_FILE[jenis], dataUmum);
    const safeTanggal = String(dataUmum.tanggal).replace(/[^0-9-]/g, "");
    const filename = `${FILENAME_PREFIX[jenis]}_${safeTanggal}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e: any) {
    // Detail teknis hanya ke log server -- tidak dikirim ke browser.
    console.error("[generate-dokumen] gagal render template:", e);
    return NextResponse.json({ error: "Gagal membuat dokumen. Cek kelengkapan data pengajuan." }, { status: 500 });
  }
}
