import { NextRequest, NextResponse } from "next/server";
import { requireUser, isUuid } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validasiInput } from "@/lib/perjadin/simpan";
import { simpanPerjadin } from "@/lib/perjadin/persist";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 }); }
  let raw: any;
  try { raw = JSON.parse(String(form.get("data") ?? "{}")); } catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }
  const v = validasiInput(raw);
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });

  const supabase = await createClient();
  const { data: ada } = await supabase.from("perjadin").select("id, tahun_anggaran").eq("id", id).maybeSingle();
  if (!ada) return NextResponse.json({ error: "Data tidak ditemukan." }, { status: 404 });

  const res = await simpanPerjadin(supabase, {
    id, userId: auth.user.id, input: v.data, lama: v.lama_hari,
    tahun: ada.tahun_anggaran, suratTugas: form.get("surat_tugas"), laporan: form.get("laporan"),
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ id: res.id, peringatan: res.peringatan });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });

  const supabase = await createClient();
  const { data: row } = await supabase.from("perjadin").select("surat_tugas_path, laporan_path").eq("id", id).maybeSingle();
  const paths = [row?.surat_tugas_path, row?.laporan_path].filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from("perjalanan-dinas").remove(paths);
  const { error } = await supabase.from("perjadin").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
