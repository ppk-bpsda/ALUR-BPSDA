import { NextRequest, NextResponse } from "next/server";
import { requireUser, isUuid } from "@/lib/auth";
import { buildSuratTugas } from "@/lib/perjadin/naskah";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });

  try {
    const { buffer, filename } = await buildSuratTugas(id);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal membuat Surat Tugas." }, { status: 500 });
  }
}
