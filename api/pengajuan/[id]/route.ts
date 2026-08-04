import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const id = params.id;
  const body = await req.json();

  const {
    dpa_id, tanggal, uraian_kegiatan, penyedia_id, nama_penerima, cetak_ttd_penerima,
    metode_pembayaran, nomor_nota_dinas, nomor_bukti,
    rincian, potongan,
  }: {
    dpa_id: string;
    tanggal: string;
    uraian_kegiatan: string;
    penyedia_id: string | null;
    nama_penerima: string | null;
    cetak_ttd_penerima?: boolean;
    metode_pembayaran: "LS" | "GU";
    nomor_nota_dinas: string | null;
    nomor_bukti: string | null;
    rincian: { nama_item: string; qty: number; satuan: string; harga_satuan: number; kena_ppn_tambahan?: boolean }[];
    potongan: { jenis_pajak: string; persentase: number; nominal: number; tipe?: "potongan" | "tambahan" }[];
  } = body;

  // Lihat komentar setara di app/api/pengajuan/route.ts -- jumlah_pengajuan
  // harus ikut memasukkan potongan bertipe 'tambahan' (PPN atas harga netto).
  const totalTambahan = (potongan ?? [])
    .filter((p) => p.tipe === "tambahan")
    .reduce((s, p) => s + Number(p.nominal || 0), 0);
  const jumlah_pengajuan = rincian.reduce((s, r) => s + r.qty * r.harga_satuan, 0) + totalTambahan;

  const { error: errPengajuan } = await supabase
    .from("pengajuan_belanja")
    .update({
      dpa_id, tanggal, uraian_kegiatan, penyedia_id: penyedia_id || null,
      nama_penerima: nama_penerima || null,
      cetak_ttd_penerima: cetak_ttd_penerima ?? true,
      jumlah_pengajuan,
      metode_pembayaran: metode_pembayaran || "GU",
      nomor_nota_dinas: nomor_nota_dinas?.trim() || null,
      nomor_bukti: nomor_bukti?.trim() || null,
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

// PATCH -- ubah status saja (draft/diajukan/disetujui/dicairkan/ditolak).
// PENTING: kalkulasi "Realisasi Sblm" & "Sisa" di Nota Dinas HANYA
// menghitung pengajuan berstatus disetujui/dicairkan (lihat
// lib/dokumenData.ts) -- jadi status di sini harus diubah manual dari
// "draft" begitu pengajuan sudah final/cair, kalau tidak Realisasi Sblm
// akan selalu 0 di Nota Dinas berikutnya.
const STATUS_VALID = ["draft", "diajukan", "disetujui", "dicairkan", "ditolak"];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const body = await req.json();
  const status = String(body?.status || "");

  if (!STATUS_VALID.includes(status)) {
    return NextResponse.json({ error: `Status tidak valid. Pilih salah satu: ${STATUS_VALID.join(", ")}.` }, { status: 400 });
  }

  const { error } = await supabase.from("pengajuan_belanja").update({ status }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, status });
}
