import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deteksiJenis, MAKS_UKURAN_BERKAS } from "@/lib/perjadin/extract";

export const dynamic = "force-dynamic";

const s = (v: unknown) => String(v ?? "").trim();
const angka = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return isFinite(n) ? Math.round(n) : 0;
};

/**
 * Impor Excel. ?jenis=pegawai  kolom: No | Nama | NIP | Pangkat/Gol | Jabatan
 *              ?jenis=sbu&tahun=2026  kolom: Tujuan | Satuan | Rapat | Diklat | Perjalanan Dinas
 * Baris pertama = judul kolom. Data yang sudah ada diperbarui (NIP / Tujuan+Tahun sebagai kunci).
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const jenis = req.nextUrl.searchParams.get("jenis");
  if (jenis !== "pegawai" && jenis !== "sbu") return NextResponse.json({ error: "Jenis impor tidak valid." }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const f = form?.get("file");
  if (!(f instanceof File) || f.size === 0) return NextResponse.json({ error: "Pilih berkas Excel terlebih dahulu." }, { status: 400 });
  if (f.size > MAKS_UKURAN_BERKAS) return NextResponse.json({ error: "Ukuran berkas melebihi 4 MB." }, { status: 400 });
  const buf = Buffer.from(await f.arrayBuffer());
  if (deteksiJenis(f.name, buf) !== "xlsx") return NextResponse.json({ error: "Berkas harus berformat Excel (.xlsx/.xls)." }, { status: 400 });

  let rows: any[][];
  try {
    const wb = XLSX.read(buf, { type: "buffer" });
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" });
  } catch {
    return NextResponse.json({ error: "Berkas Excel tidak dapat dibaca." }, { status: 422 });
  }
  const data = rows.slice(1).filter((r) => r.some((c) => s(c)));
  if (data.length === 0) return NextResponse.json({ error: "Tidak ada data pada berkas." }, { status: 422 });
  if (data.length > 2000) return NextResponse.json({ error: "Terlalu banyak baris (maks. 2000)." }, { status: 422 });

  const supabase = await createClient();

  if (jenis === "pegawai") {
    const mapped = new Map<string, any>();
    const lewati: string[] = [];
    data.forEach((r, i) => {
      const nama = s(r[1]), nip = s(r[2]).replace(/\s+/g, "");
      if (!nama || nip.length < 8) { lewati.push(`Baris ${i + 2}: nama/NIP kosong atau tidak valid`); return; }
      mapped.set(nip, { nama: nama.slice(0, 200), nip, pangkat_gol: s(r[3]).slice(0, 100) || null, jabatan: s(r[4]).slice(0, 250) || null, urut: angka(r[0]) || i + 1, aktif: true, updated_at: new Date().toISOString() });
    });
    const { error } = await supabase.from("perjadin_pegawai").upsert(Array.from(mapped.values()), { onConflict: "nip" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ jumlah: mapped.size, lewati });
  }

  const tahun = Number(req.nextUrl.searchParams.get("tahun")) || new Date().getFullYear();
  if (tahun < 2000 || tahun > 2100) return NextResponse.json({ error: "Tahun tidak valid." }, { status: 400 });
  const mapped = new Map<string, any>();
  const lewati: string[] = [];
  data.forEach((r, i) => {
    const tujuan = s(r[0]);
    if (!tujuan) { lewati.push(`Baris ${i + 2}: tujuan kosong`); return; }
    mapped.set(tujuan.toLowerCase(), {
      tahun_anggaran: tahun, tujuan: tujuan.slice(0, 150), satuan: s(r[1]).slice(0, 50) || "Orang / Hari",
      uang_harian_rapat: angka(r[2]), uang_harian_diklat: angka(r[3]), uang_harian_perjalanan: angka(r[4]),
    });
  });
  const { error } = await supabase.from("perjadin_sbu").upsert(Array.from(mapped.values()), { onConflict: "tahun_anggaran,tujuan" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ jumlah: mapped.size, lewati });
}
