import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const id = params.id;
  const body = await req.json();

  const {
    dpa_id, tanggal, uraian_kegiatan, penyedia_id, nama_penerima,
    rincian, potongan,
  }: {
    dpa_id: string;
    tanggal: string;
    uraian_kegiatan: string;
    penyedia_id: string | null;
    nama_penerima: string | null;
    rincian: { nama_item: string; qty: number; satuan: string; harga_satuan: number }[];
    potongan: { jenis_pajak: string; persentase: number; nominal: number }[];
  } = body;

  const jumlah_pengajuan = rincian.reduce((s, r) => s + r.qty * r.harga_satuan, 0);

  const { error: errPengajuan } = await supabase
    .from("pengajuan_belanja")
    .update({
      dpa_id, tanggal, uraian_kegiatan, penyedia_id: penyedia_id || null,
      nama_penerima: nama_penerima || null, jumlah_pengajuan,
    })
    .eq("id", id);
  if (errPengajuan) return NextResponse.json({ error: errPengajuan.message }, { status: 400 });

  // Rincian & potongan diganti total (hapus lalu insert ulang) -- lebih
  // sederhana & aman daripada diff per baris, dan volumenya kecil per
  // pengajuan jadi tidak masalah dari sisi performa.
  const { error: errDelRincian } = await supabase.from("rincian_belanja").delete().eq("pengajuan_id", id);
  if (errDelRincian) return NextResponse.json({ error: errDelRincian.message }, { status: 400 });

  const { error: errDelPotongan } = await supabase.from("potongan_pajak").delete().eq("pengajuan_id", id);
  if (errDelPotongan) return NextResponse.json({ error: errDelPotongan.message }, { status: 400 });

  if (rincian.length > 0) {
    const { error } = await supabase.from("rincian_belanja").insert(rincian.map((r) => ({ ...r, pengajuan_id: id })));
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (potongan.length > 0) {
    const { error } = await supabase.from("potongan_pajak").insert(potongan.map((p) => ({ ...p, pengajuan_id: id })));
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  // rincian_belanja & potongan_pajak sudah ON DELETE CASCADE dari
  // pengajuan_belanja, jadi cukup hapus baris induknya saja.
  const { error } = await supabase.from("pengajuan_belanja").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
