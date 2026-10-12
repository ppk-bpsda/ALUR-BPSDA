import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { parsePengajuanBody } from "@/lib/pengajuanValidation";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body request bukan JSON yang valid." }, { status: 400 });
  }

  const parsed = parsePengajuanBody(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;

  const supabase = await createClient();

  const { data: pengajuan, error: errPengajuan } = await supabase
    .from("pengajuan_belanja")
    .insert({
      dpa_id: d.dpa_id,
      tanggal: d.tanggal,
      uraian_kegiatan: d.uraian_kegiatan,
      penyedia_id: d.penyedia_id,
      nama_penerima: d.nama_penerima,
      cetak_ttd_penerima: d.cetak_ttd_penerima,
      jumlah_pengajuan: d.jumlah_pengajuan, // dihitung ulang di server
      status: "draft",
      metode_pembayaran: d.metode_pembayaran,
      nomor_nota_dinas: d.nomor_nota_dinas,
      nomor_bukti: d.nomor_bukti,
      dibuat_oleh: auth.user.id,
    })
    .select("id")
    .single();

  if (errPengajuan || !pengajuan) {
    return NextResponse.json({ error: errPengajuan?.message || "Gagal menyimpan pengajuan." }, { status: 400 });
  }

  // Jika rincian/potongan gagal tersimpan, header yang sudah terlanjur dibuat
  // HARUS dihapus -- kalau tidak, tersisa pengajuan "yatim" dengan jumlah
  // tanpa rincian yang ikut terhitung di rekap/realisasi.
  const rollback = async () => {
    await supabase.from("pengajuan_belanja").delete().eq("id", pengajuan.id);
  };

  const { error: errRincian } = await supabase.from("rincian_belanja").insert(
    d.rincian.map((r) => ({
      pengajuan_id: pengajuan.id,
      nama_item: r.nama_item,
      qty: r.qty,
      satuan: r.satuan,
      harga_satuan: r.harga_satuan,
      kena_ppn_tambahan: r.kena_ppn_tambahan,
    }))
  );
  if (errRincian) {
    await rollback();
    return NextResponse.json({ error: errRincian.message }, { status: 400 });
  }

  if (d.potongan.length > 0) {
    // Semua baris punya `tipe` eksplisit -- campuran key dalam satu bulk
    // insert membuat PostgREST mengirim NULL (bukan DEFAULT) dan melanggar
    // NOT NULL di kolom potongan_pajak.tipe.
    const { error: errPotongan } = await supabase.from("potongan_pajak").insert(
      d.potongan.map((p) => ({
        pengajuan_id: pengajuan.id,
        jenis_pajak: p.jenis_pajak,
        persentase: p.persentase,
        nominal: p.nominal,
        tipe: p.tipe,
      }))
    );
    if (errPotongan) {
      await rollback();
      return NextResponse.json({ error: errPotongan.message }, { status: 400 });
    }
  }

  return NextResponse.json({ id: pengajuan.id });
}
