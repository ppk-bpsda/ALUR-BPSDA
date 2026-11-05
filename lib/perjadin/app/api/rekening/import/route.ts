import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPeriode } from "@/lib/periode";
import { bacaWorkbook, susunRencana, MAKS_BARIS } from "@/lib/anggaran/pagu";
import { muatDataAcuan } from "@/lib/anggaran/muat";
import { terapkanRencana } from "@/lib/anggaran/simpan";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAKS_BYTE = 4 * 1024 * 1024;

/**
 * Impor / pembaruan pagu dari Excel untuk periode aktif (Tahun Anggaran + Tahapan).
 * ?mode=pratinjau (default) hanya menghitung rencana; ?mode=simpan menyimpannya
 * (ditolak bila masih ada baris galat). Pratinjau & simpan memakai fungsi yang sama.
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
  const { baris, galat } = bacaWorkbook(Buffer.from(await f.arrayBuffer()));
  if (galat) return NextResponse.json({ error: galat }, { status: 400 });
  if (baris.length === 0) return NextResponse.json({ error: "Tidak ada baris data pada berkas." }, { status: 400 });
  if (baris.length > MAKS_BARIS) return NextResponse.json({ error: `Maksimal ${MAKS_BARIS} baris per impor.` }, { status: 400 });

  try {
    const supabase = await createClient();
    const acuan = await muatDataAcuan(supabase, tahun, tahapan);
    const rencana = susunRencana(baris, acuan);
    const ringkasan = {
      total: rencana.length,
      baru: rencana.filter((r) => r.status === "baru").length,
      ubah: rencana.filter((r) => r.status === "ubah").length,
      sama: rencana.filter((r) => r.status === "sama").length,
      galat: rencana.filter((r) => r.status === "galat").length,
      subBaru: new Set(rencana.filter((r) => r.buat_sub_kegiatan).map((r) => r.kode_sub_kegiatan)).size,
      selisih: rencana.reduce((s, r) => (r.status === "galat" ? s : s + r.selisih), 0),
    };

    if (!simpan) return NextResponse.json({ tahun, tahapan, ringkasan, rencana });

    if (ringkasan.galat > 0) return NextResponse.json({ error: "Masih ada baris galat. Perbaiki berkas lalu periksa ulang.", ringkasan }, { status: 400 });
    if (ringkasan.baru + ringkasan.ubah === 0) return NextResponse.json({ error: "Tidak ada perubahan untuk disimpan." }, { status: 400 });

    const hasil = await terapkanRencana(supabase, tahun, tahapan, rencana);
    revalidatePath("/rekening"); revalidatePath("/rekap-pagu"); revalidatePath("/anggaran-kas"); revalidatePath("/rekap");
    return NextResponse.json({ ok: true, hasil, ringkasan });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal memproses berkas." }, { status: 500 });
  }
}
