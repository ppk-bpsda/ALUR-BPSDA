import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ekstrakTeks } from "@/lib/perjadin/extract";
import { parseSuratTugas } from "@/lib/perjadin/parse";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Membaca Surat Tugas (+ Laporan) lalu menebak isian formulir. Tidak menyimpan apa pun. */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }
  const st = form.get("surat_tugas");
  const lap = form.get("laporan");
  if (!(st instanceof File) || st.size === 0) {
    return NextResponse.json({ error: "Unggah berkas Surat Tugas terlebih dahulu." }, { status: 400 });
  }

  const catatan: string[] = [];
  let teksST = "", teksLap = "";
  try {
    teksST = (await ekstrakTeks(st.name, Buffer.from(await st.arrayBuffer()))).teks;
    if (teksST.length < 20) catatan.push("Surat Tugas tampaknya berupa gambar/hasil scan sehingga teksnya tidak terbaca — isi formulir secara manual.");
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal membaca Surat Tugas." }, { status: 422 });
  }
  if (lap instanceof File && lap.size > 0) {
    try {
      teksLap = (await ekstrakTeks(lap.name, Buffer.from(await lap.arrayBuffer()))).teks;
      if (teksLap.length < 20) catatan.push("Laporan Perjalanan Dinas tidak memuat teks yang terbaca (mungkin hasil scan).");
    } catch (e: any) {
      catatan.push(`Laporan tidak dapat dibaca: ${e?.message || "kesalahan tidak diketahui"}`);
    }
  }

  const supabase = await createClient();
  const [{ data: pegawai }, { data: sbu }] = await Promise.all([
    supabase.from("perjadin_pegawai").select("id, nama, nip").eq("aktif", true),
    supabase.from("perjadin_sbu").select("tujuan"),
  ]);
  const hasil = parseSuratTugas(
    teksST, teksLap, pegawai ?? [],
    Array.from(new Set((sbu ?? []).map((s: any) => s.tujuan as string)))
  );
  hasil.catatan.unshift(...catatan);
  return NextResponse.json({ hasil });
}
