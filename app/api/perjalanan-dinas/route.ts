import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validasiInput } from "@/lib/perjadin/simpan";
import { simpanPerjadin } from "@/lib/perjadin/persist";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Buat administrasi perjalanan dinas baru (multipart: data JSON + berkas opsional). */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 }); }

  let raw: any;
  try { raw = JSON.parse(String(form.get("data") ?? "{}")); } catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }
  const v = validasiInput(raw);
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });

  const supabase = await createClient();
  const res = await simpanPerjadin(supabase, {
    id: null, userId: auth.user.id, input: v.data, lama: v.lama_hari,
    tahun: Number(raw.tahun_anggaran) || new Date().getFullYear(),
    suratTugas: form.get("surat_tugas"), laporan: form.get("laporan"),
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ id: res.id, peringatan: res.peringatan });
}
