import { createClient } from "@/lib/supabase/server";
import { requireUser, isUuid } from "@/lib/auth";
import { parsePengajuanBody } from "@/lib/pengajuanValidation";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function readJson(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Body request bukan JSON yang valid." }, { status: 400 }) };
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id: paramId } = await ctx.params;
  if (!isUuid(paramId)) return NextResponse.json({ error: "ID pengajuan tidak valid." }, { status: 400 });

  const j = await readJson(req);
  if (!j.ok) return j.response;
  const parsed = parsePengajuanBody(j.body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;
  const id = paramId;

  const supabase = await createClient();

  // --- Snapshot kondisi lama (untuk rollback bila ada langkah yang gagal) ---
  const { data: oldHeader, error: errOld } = await supabase
    .from("pengajuan_belanja")
    .select("dpa_id, tanggal, uraian_kegiatan, penyedia_id, nama_penerima, cetak_ttd_penerima, jumlah_pengajuan, metode_pembayaran, nomor_nota_dinas, nomor_bukti")
    .eq("id", id)
    .maybeSingle();
  if (errOld) return NextResponse.json({ error: errOld.message }, { status: 400 });
  if (!oldHeader) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });

  const { data: oldRincian } = await supabase.from("rincian_belanja").select("id").eq("pengajuan_id", id);
  const { data: oldPotongan } = await supabase.from("potongan_pajak").select("id").eq("pengajuan_id", id);
  const oldRincianIds = (oldRincian ?? []).map((r: any) => r.id);
  const oldPotonganIds = (oldPotongan ?? []).map((r: any) => r.id);

  // 1) Header
  const { error: errHeader } = await supabase
    .from("pengajuan_belanja")
    .update({
      dpa_id: d.dpa_id,
      tanggal: d.tanggal,
      uraian_kegiatan: d.uraian_kegiatan,
      penyedia_id: d.penyedia_id,
      nama_penerima: d.nama_penerima,
      cetak_ttd_penerima: d.cetak_ttd_penerima,
      jumlah_pengajuan: d.jumlah_pengajuan,
      metode_pembayaran: d.metode_pembayaran,
      nomor_nota_dinas: d.nomor_nota_dinas,
      nomor_bukti: d.nomor_bukti,
    })
    .eq("id", id);
  if (errHeader) return NextResponse.json({ error: errHeader.message }, { status: 400 });

  const restoreHeader = () => supabase.from("pengajuan_belanja").update(oldHeader).eq("id", id);

  // 2) INSERT baris baru DULU (sebelum menghapus yang lama). Versi lama
  //    menghapus dulu lalu insert -- kalau insert gagal, rincian & potongan
  //    lama sudah hilang permanen. Dengan urutan ini, kegagalan di tahap
  //    manapun bisa dibatalkan tanpa kehilangan data.
  const { data: newRincian, error: errRincian } = await supabase
    .from("rincian_belanja")
    .insert(
      d.rincian.map((r) => ({
        pengajuan_id: id,
        nama_item: r.nama_item,
        qty: r.qty,
        satuan: r.satuan,
        harga_satuan: r.harga_satuan,
        kena_ppn_tambahan: r.kena_ppn_tambahan,
      }))
    )
    .select("id");
  if (errRincian) {
    await restoreHeader();
    return NextResponse.json({ error: errRincian.message }, { status: 400 });
  }
  const newRincianIds = (newRincian ?? []).map((r: any) => r.id);

  let newPotonganIds: string[] = [];
  if (d.potongan.length > 0) {
    const { data: newPotongan, error: errPotongan } = await supabase
      .from("potongan_pajak")
      .insert(
        d.potongan.map((p) => ({
          pengajuan_id: id,
          jenis_pajak: p.jenis_pajak,
          persentase: p.persentase,
          nominal: p.nominal,
          tipe: p.tipe,
        }))
      )
      .select("id");
    if (errPotongan) {
      if (newRincianIds.length) await supabase.from("rincian_belanja").delete().in("id", newRincianIds);
      await restoreHeader();
      return NextResponse.json({ error: errPotongan.message }, { status: 400 });
    }
    newPotonganIds = (newPotongan ?? []).map((r: any) => r.id);
  }

  // 3) Hapus baris lama (berdasarkan id snapshot)
  if (oldRincianIds.length) {
    const { error } = await supabase.from("rincian_belanja").delete().in("id", oldRincianIds);
    if (error) {
      if (newRincianIds.length) await supabase.from("rincian_belanja").delete().in("id", newRincianIds);
      if (newPotonganIds.length) await supabase.from("potongan_pajak").delete().in("id", newPotonganIds);
      await restoreHeader();
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }
  if (oldPotonganIds.length) {
    const { error } = await supabase.from("potongan_pajak").delete().in("id", oldPotonganIds);
    if (error) {
      // rincian lama sudah terhapus & baru sudah masuk; potongan lama masih ada
      // -> hapus potongan baru agar tidak dobel, header dikembalikan.
      if (newPotonganIds.length) await supabase.from("potongan_pajak").delete().in("id", newPotonganIds);
      return NextResponse.json(
        { error: "Sebagian data lama gagal dibersihkan: " + error.message + ". Buka pengajuan ini dan simpan ulang." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ id });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id: paramId } = await ctx.params;
  if (!isUuid(paramId)) return NextResponse.json({ error: "ID pengajuan tidak valid." }, { status: 400 });

  const supabase = await createClient();
  // rincian_belanja & potongan_pajak sudah ON DELETE CASCADE dari pengajuan_belanja.
  const { data, error } = await supabase.from("pengajuan_belanja").delete().eq("id", paramId).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// PATCH -- ubah status saja (draft/diajukan/disetujui/dicairkan/ditolak).
// PENTING: kalkulasi "Realisasi Sblm" & "Sisa" di Nota Dinas HANYA
// menghitung pengajuan berstatus disetujui/dicairkan (lihat
// lib/dokumenData.ts).
const STATUS_VALID = ["draft", "diajukan", "disetujui", "dicairkan", "ditolak"];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id: paramId } = await ctx.params;
  if (!isUuid(paramId)) return NextResponse.json({ error: "ID pengajuan tidak valid." }, { status: 400 });

  const j = await readJson(req);
  if (!j.ok) return j.response;
  const status = String((j.body as any)?.status || "");

  if (!STATUS_VALID.includes(status)) {
    return NextResponse.json({ error: `Status tidak valid. Pilih salah satu: ${STATUS_VALID.join(", ")}.` }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("pengajuan_belanja").update({ status }).eq("id", paramId).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ ok: true, status });
}
