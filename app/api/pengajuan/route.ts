import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const body = await req.json();

  const {
    dpa_id, tanggal, uraian_kegiatan, penyedia_id, nama_penerima,
    metode_pembayaran, nomor_nota_dinas, nomor_bukti,
    rincian, potongan,
  }: {
    dpa_id: string;
    tanggal: string;
    uraian_kegiatan: string;
    penyedia_id: string | null;
    nama_penerima: string | null;
    metode_pembayaran: "LS" | "GU";
    nomor_nota_dinas: string | null;
    nomor_bukti: string | null;
    rincian: { nama_item: string; qty: number; satuan: string; harga_satuan: number; kena_ppn_tambahan?: boolean }[];
    potongan: { jenis_pajak: string; persentase: number; nominal: number; tipe?: "potongan" | "tambahan" }[];
  } = body;

  // jumlah_pengajuan = Total Tagihan yang sebenarnya dibebankan ke
  // anggaran (bukan cuma jumlah harga di Rincian Item) -- kalau ada
  // potongan bertipe 'tambahan' (mis. PPN yang dihitung terpisah di
  // atas harga netto, lihat migrasi 20260726020000), nilainya harus
  // ikut ditambahkan supaya realisasi anggaran tidak understated.
  const totalTambahan = (potongan ?? [])
    .filter((p) => p.tipe === "tambahan")
    .reduce((s, p) => s + Number(p.nominal || 0), 0);
  const jumlah_pengajuan = rincian.reduce((s, r) => s + r.qty * r.harga_satuan, 0) + totalTambahan;

  const { data: pengajuan, error: errPengajuan } = await supabase
    .from("pengajuan_belanja")
    .insert({
      dpa_id, tanggal, uraian_kegiatan, penyedia_id: penyedia_id || null,
      nama_penerima: nama_penerima || null, jumlah_pengajuan, status: "draft",
      metode_pembayaran: metode_pembayaran || "GU",
      nomor_nota_dinas: nomor_nota_dinas?.trim() || null,
      nomor_bukti: nomor_bukti?.trim() || null,
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
