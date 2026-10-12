import { createClient } from "@/lib/supabase/server";
import { requireUser, isUuid } from "@/lib/auth";
import { NextResponse } from "next/server";

// Dipakai dari form Pengajuan Belanja Baru/Edit untuk membetulkan data
// lama yang kelompok_belanja-nya belum sesuai 2 pilihan baku ("Belanja
// Barang/Jasa" / "Belanja Modal") -- lihat catatan pegawai: banyak baris
// rekening lama masih berisi "Belanja Operasi" dari sebelum aturan ini
// dibuat, dan menyuruh pegawai balik ke halaman admin Rekening & Pagu
// satu-satu terlalu merepotkan.
const PILIHAN_VALID = ["Belanja Barang/Jasa", "Belanja Modal"];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id: paramId } = await ctx.params;
  if (!isUuid(paramId)) return NextResponse.json({ error: "ID rekening tidak valid." }, { status: 400 });

  const supabase = await createClient();
  const id = paramId;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body request bukan JSON yang valid." }, { status: 400 });
  }
  const kelompok_belanja = String(body?.kelompok_belanja || "");

  if (!PILIHAN_VALID.includes(kelompok_belanja)) {
    return NextResponse.json(
      { error: `kelompok_belanja harus salah satu dari: ${PILIHAN_VALID.join(", ")}` },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("rekening_belanja").update({ kelompok_belanja }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
