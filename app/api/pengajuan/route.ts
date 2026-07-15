import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const body = await req.json();

  const {
    dpa_id, tanggal, uraian_kegiatan, penyedia_id, penerima_id,
    rincian, potongan,
  }: {
    dpa_id: string;
    tanggal: string;
    uraian_kegiatan: string;
    penyedia_id: string | null;
    penerima_id: string | null;
    rincian: { nama_item: string; qty: number; satuan: string; harga_satuan: number }[];
    potongan: { jenis_pajak: string; persentase: number; nominal: number }[];
  } = body;

  const jumlah_pengajuan = rincian.reduce((s, r) => s + r.qty * r.harga_satuan, 0);

  const { data: pengajuan, error: errPengajuan } = await supabase
    .from("pengajuan_belanja")
    .insert({
      dpa_id, tanggal, uraian_kegiatan, penyedia_id: penyedia_id || null,
      penerima_id: penerima_id || null, jumlah_pengajuan, status: "draft",
    })
    .select()
    .single();

  if (errPengajuan) {
    return NextResponse.json({ error: errPengajuan.message }, { status: 400 });
  }

  if (rincian.length > 0) {
    const { error: errRincian } = await supabase.from("rincian_belanja").insert(
      rincian.map((r) => ({ ...r, pengajuan_id: pengajuan.id }))
    );
    if (errRincian) return NextResponse.json({ error: errRincian.message }, { status: 400 });
  }

  if (potongan.length > 0) {
    const { error: errPotongan } = await supabase.from("potongan_pajak").insert(
      potongan.map((p) => ({ ...p, pengajuan_id: pengajuan.id }))
    );
    if (errPotongan) return NextResponse.json({ error: errPotongan.message }, { status: 400 });
  }

  return NextResponse.json({ id: pengajuan.id });
}
