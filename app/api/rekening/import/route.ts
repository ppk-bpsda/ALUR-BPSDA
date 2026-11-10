import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPeriode } from "@/lib/periode";
import { bacaWorkbook, susunRencana, ringkasRencana, MAKS_BARIS } from "@/lib/anggaran/pagu";
import { muatDataAcuan } from "@/lib/anggaran/muat";
import { terapkanRencana } from "@/lib/anggaran/simpan";
import { friendlyError } from "@/lib/flash";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAKS_BYTE = 4 * 1024 * 1024;

/**
 * Impor / pembaruan pagu dari Excel untuk periode aktif (Tahun Anggaran + Tahapan).
 * ?mode=pratinjau (default) hanya menghitung rencana; ?mode=simpan menyimpannya.
 * Pratinjau & simpan memakai fungsi yang sama, jadi yang dilihat = yang disimpan.
 *
 * Pengaman saat simpan:
 *  - ditolak bila masih ada baris galat;
 *  - ditolak bila periode (tahun+tahapan) di layar berbeda dari periode aktif sekarang
 *    (mis. periode diganti di tab lain);
 *  - baris yang perlu diperiksa (rekening baru di luar katalog, koreksi master) hanya
 *    disimpan bila konfirmasi=1;
 *  - database menolak bila pagu sudah diubah pengguna lain sejak pratinjau.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const simpan = req.nextUrl.searchParams.get("mode") === "simpan";
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 }); }
  const f = form.get("file");
  if (!(f instanceof File) || f.size === 0) return NextResponse.json({ error: "Pilih berkas Excel (.xlsx) atau CSV." }, { status: 400 });
  if (f.size > MAKS_BYTE) return NextResponse.json({ error: "Ukuran berkas melebihi 4 MB." }, { status: 400 });

  const { tahun, tahapan } = await getPeriode();

  if (simpan) {
    const dilihat = String(form.get("periode") || "");
    if (dilihat && dilihat !== `${tahun}|${tahapan}`) {
      return NextResponse.json({ error: "Periode aktif berubah sejak pratinjau (mungkin diganti di tab lain). Muat ulang halaman lalu periksa kembali." }, { status: 409 });
    }
  }

  const { baris, galat } = bacaWorkbook(Buffer.from(await f.arrayBuffer()));
  if (galat) return NextResponse.json({ error: galat }, { status: 400 });
  if (baris.length === 0) return NextResponse.json({ error: "Tidak ada baris data pada berkas." }, { status: 400 });
  if (baris.length > MAKS_BARIS) return NextResponse.json({ error: `Maksimal ${MAKS_BARIS} baris per impor.` }, { status: 400 });

  try {
    const supabase = await createClient();
    const acuan = await muatDataAcuan(supabase, tahun, tahapan);
    const rencana = susunRencana(baris, acuan, tahapan);
    const ringkasan = ringkasRencana(rencana, acuan);

    if (!simpan) return NextResponse.json({ tahun, tahapan, ringkasan, rencana, katalogAktif: acuan.katalogBelanja.size > 0 });

    if (ringkasan.galat > 0) return NextResponse.json({ error: "Masih ada baris galat. Perbaiki berkas lalu periksa ulang.", ringkasan }, { status: 400 });
    if (ringkasan.baru + ringkasan.ubah + ringkasan.koreksi === 0) return NextResponse.json({ error: "Tidak ada perubahan untuk disimpan.", ringkasan }, { status: 400 });
    if (ringkasan.perluKonfirmasi > 0 && form.get("konfirmasi") !== "1") {
      return NextResponse.json({ error: `Ada ${ringkasan.perluKonfirmasi} baris yang harus diperiksa dulu (rekening baru di luar katalog / koreksi kode). Centang konfirmasi setelah memeriksanya.`, ringkasan }, { status: 400 });
    }

    const hasil = await terapkanRencana(supabase, tahun, tahapan, rencana, f.name, ringkasan);
    for (const p of ["/rekening", "/rekap-pagu", "/anggaran-kas", "/rekap"]) revalidatePath(p);
    return NextResponse.json({ ok: true, hasil, ringkasan });
  } catch (e: any) {
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
