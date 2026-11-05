"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPeriode } from "@/lib/periode";
import { failTo, okTo } from "@/lib/flash";
import { ambilSemua } from "@/lib/anggaran/muat";

const HAL = "/anggaran-kas";
const c2 = (n: number) => Math.round(n * 100) / 100;

async function dpaPeriode(supabase: any, tahun: number, tahapan: string) {
  return ambilSemua<any>((a, b) =>
    supabase.from("dpa").select("id, pagu_anggaran").eq("tahun_anggaran", tahun).eq("tahapan", tahapan).order("id").range(a, b)
  );
}

const jumlahKas = (k: any) => (k ? Number(k.tw1) + Number(k.tw2) + Number(k.tw3) + Number(k.tw4) : 0);
const pesanTabel = (m: string) => (/anggaran_kas/.test(m) ? "Tabel anggaran_kas belum ada: jalankan migrasi 20260806000000_anggaran_kas.sql di Supabase." : m);

/** DPA satu tahapan + anggaran kasnya (embed, tanpa daftar id panjang di URL). */
async function dpaDenganKas(supabase: any, tahun: number, tahapan: string) {
  try {
    const rows = await ambilSemua<any>((a, b) =>
      supabase.from("dpa").select("id, rekening_id, pagu_anggaran, kas:anggaran_kas(tw1, tw2, tw3, tw4)")
        .eq("tahun_anggaran", tahun).eq("tahapan", tahapan).order("id").range(a, b)
    );
    return rows.map((r) => ({ ...r, kas: Array.isArray(r.kas) ? r.kas[0] ?? null : r.kas }));
  } catch (e: any) { failTo(HAL, pesanTabel(e?.message || "")); }
}

async function tulis(supabase: any, baris: { dpa_id: string; tw1: number; tw2: number; tw3: number; tw4: number }[]) {
  const now = new Date().toISOString();
  for (let i = 0; i < baris.length; i += 500) {
    const { error } = await supabase.from("anggaran_kas")
      .upsert(baris.slice(i, i + 500).map((b) => ({ ...b, updated_at: now })), { onConflict: "dpa_id" });
    if (error) failTo(HAL, pesanTabel(error.message));
  }
}

/** Simpan isian TW1-TW4 semua baris yang tampil (field kas_<dpa_id>_<1-4>). */
export async function simpanAnggaranKas(formData: FormData) {
  const { tahun, tahapan } = await getPeriode();
  const supabase = await createClient();
  const sah = new Set((await dpaPeriode(supabase, tahun, tahapan)).map((d) => d.id));

  const peta = new Map<string, number[]>();
  for (const [k, v] of formData.entries()) {
    const m = /^kas_([0-9a-f-]{36})_([1-4])$/.exec(k);
    if (!m || !sah.has(m[1])) continue;
    const n = Number(String(v).replace(/[^0-9.\-]/g, "") || 0);
    if (!Number.isFinite(n) || n < 0) failTo(HAL, "Anggaran kas harus berupa angka dan tidak boleh negatif.");
    const arr = peta.get(m[1]) ?? [0, 0, 0, 0];
    arr[Number(m[2]) - 1] = c2(n);
    peta.set(m[1], arr);
  }
  if (peta.size === 0) failTo(HAL, "Tidak ada data untuk disimpan.");
  await tulis(supabase, [...peta].map(([dpa_id, a]) => ({ dpa_id, tw1: a[0], tw2: a[1], tw3: a[2], tw4: a[3] })));
  revalidatePath(HAL);
  okTo(HAL, `Anggaran kas ${peta.size} belanja tersimpan.`);
}

/** Isi merata (pagu/4, sisa pembulatan ke TW4) hanya untuk belanja yang kasnya masih kosong. */
export async function bagiRataKas() {
  const { tahun, tahapan } = await getPeriode();
  const supabase = await createClient();
  const dpa = await dpaDenganKas(supabase, tahun, tahapan);
  const baris = dpa.filter((d: any) => jumlahKas(d.kas) === 0 && Number(d.pagu_anggaran) > 0).map((d: any) => {
    const p = Number(d.pagu_anggaran), q = Math.floor((p * 100) / 4) / 100;
    return { dpa_id: d.id as string, tw1: q, tw2: q, tw3: q, tw4: c2(p - q * 3) };
  });
  if (baris.length === 0) okTo(HAL, "Semua belanja sudah punya anggaran kas.");
  await tulis(supabase, baris);
  revalidatePath(HAL);
  okTo(HAL, `${baris.length} belanja diisi merata per triwulan. Sesuaikan lalu simpan bila perlu.`);
}

/** Salin anggaran kas dari tahapan lain (rekening yang sama) untuk belanja yang kasnya masih kosong. */
export async function salinKasDariTahapan(formData: FormData) {
  const { tahun, tahapan } = await getPeriode();
  const dari = String(formData.get("dari_tahapan") || "");
  if (!dari || dari === tahapan) failTo(HAL, "Pilih tahapan sumber yang berbeda dari tahapan aktif.");
  const supabase = await createClient();
  const [tujuan, sumber] = await Promise.all([dpaDenganKas(supabase, tahun, tahapan), dpaDenganKas(supabase, tahun, dari)]);
  const kasPerRek = new Map<string, any>(sumber.filter((s: any) => jumlahKas(s.kas) > 0).map((s: any) => [s.rekening_id, s.kas]));
  const baris = tujuan.filter((t: any) => jumlahKas(t.kas) === 0 && kasPerRek.has(t.rekening_id)).map((t: any) => {
    const k = kasPerRek.get(t.rekening_id);
    return { dpa_id: t.id as string, tw1: Number(k.tw1), tw2: Number(k.tw2), tw3: Number(k.tw3), tw4: Number(k.tw4) };
  });
  if (baris.length === 0) okTo(HAL, "Tidak ada anggaran kas yang perlu disalin.");
  await tulis(supabase, baris);
  revalidatePath(HAL);
  okTo(HAL, `${baris.length} anggaran kas disalin. Periksa kolom Selisih terhadap pagu yang baru.`);
}
