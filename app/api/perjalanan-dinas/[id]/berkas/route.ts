import { NextRequest, NextResponse } from "next/server";
import { requireUser, isUuid } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Unduh berkas unggahan lewat signed URL berumur pendek. ?jenis=surat_tugas|laporan */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const jenis = req.nextUrl.searchParams.get("jenis");
  if (!isUuid(id) || (jenis !== "surat_tugas" && jenis !== "laporan"))
    return NextResponse.json({ error: "Parameter tidak valid." }, { status: 400 });

  const supabase = await createClient();
  const { data: row } = await supabase.from("perjadin").select("surat_tugas_path, surat_tugas_nama, laporan_path, laporan_nama").eq("id", id).maybeSingle();
  const path = (row as any)?.[`${jenis}_path`] as string | undefined;
  const nama = (row as any)?.[`${jenis}_nama`] as string | undefined;
  if (!path) return NextResponse.json({ error: "Berkas tidak ditemukan." }, { status: 404 });

  const { data, error } = await supabase.storage.from("perjalanan-dinas").createSignedUrl(path, 60, { download: nama || true });
  if (error || !data) return NextResponse.json({ error: error?.message || "Gagal membuat tautan unduh." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
