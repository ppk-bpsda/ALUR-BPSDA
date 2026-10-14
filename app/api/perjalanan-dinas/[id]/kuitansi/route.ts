import { NextRequest, NextResponse } from "next/server";
import { requireUser, isUuid } from "@/lib/auth";
import { buildKuitansiSppd } from "@/lib/perjadin/kuitansi";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/** ?warna=hitam -> versi siap cetak tanpa penanda merah. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });

  try {
    const hitam = req.nextUrl.searchParams.get("warna") === "hitam";
    const { buffer, filename } = await buildKuitansiSppd(id, { hitam });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal membuat kuitansi." }, { status: 500 });
  }
}
