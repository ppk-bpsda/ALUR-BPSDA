import type { SupabaseClient } from "@supabase/supabase-js";
import type { RencanaBaris } from "./pagu";
import { catatLog, type LogAnggaran } from "./log";

export type HasilTerapan = { tambah: number; ubah: number; sama: number; subBaru: number; kegiatanBaru: number; programBaru: number; rekeningBaru: number };

/**
 * Menyimpan rencana hasil susunRencana() ke database (hanya dipanggil bila TIDAK ada baris galat).
 * Urutan: program -> kegiatan -> sub kegiatan -> rekening master -> pagu (dpa) tahapan tujuan.
 * Setiap tingkat dicari dulu (kode + tahun) baru dibuat, sehingga baris kembar dalam satu file aman.
 */
export async function terapkanRencana(
  supabase: SupabaseClient, tahun: number, tahapan: string, rencana: RencanaBaris[]
): Promise<HasilTerapan> {
  const hasil: HasilTerapan = { tambah: 0, ubah: 0, sama: 0, subBaru: 0, kegiatanBaru: 0, programBaru: 0, rekeningBaru: 0 };
  const cache = new Map<string, string>();

  async function pastikan(tabel: "program" | "kegiatan" | "sub_kegiatan", kolomKode: string, kode: string, isi: Record<string, unknown>, tandaBaru: keyof HasilTerapan) {
    const kunci = `${tabel}|${kode}`;
    const ada = cache.get(kunci);
    if (ada) return ada;
    const { data: found, error: e1 } = await supabase.from(tabel).select("id").eq(kolomKode, kode).eq("tahun_anggaran", tahun).maybeSingle();
    if (e1) throw new Error(e1.message);
    let id = found?.id as string | undefined;
    if (!id) {
      const { data, error } = await supabase.from(tabel).insert({ ...isi, [kolomKode]: kode, tahun_anggaran: tahun }).select("id").single();
      if (error || !data) throw new Error(`Gagal membuat ${tabel} ${kode}: ${error?.message}`);
      id = data.id as string;
      hasil[tandaBaru] += 1;
    }
    cache.set(kunci, id);
    return id;
  }

  // tanggal penetapan tahapan tujuan (agar pagu baru ikut resolusi tahapan menurut tanggal transaksi)
  const { data: tgl } = await supabase.from("dpa").select("tanggal_penetapan")
    .eq("tahun_anggaran", tahun).eq("tahapan", tahapan).not("tanggal_penetapan", "is", null).limit(1);
  const tanggalPenetapan = tgl?.[0]?.tanggal_penetapan ?? null;

  const log: LogAnggaran[] = [];
  const dpaBaru: any[] = [];
  const dpaBaruLog: LogAnggaran[] = [];

  for (const r of rencana) {
    if (r.status === "sama") { hasil.sama += 1; continue; }

    let subId = r.sub_kegiatan_id;
    if (!subId) {
      const progId = r.buat_program
        ? await pastikan("program", "kode_program", r.kode_program!, { nama_program: r.nama_program }, "programBaru")
        : null;
      let kegId: string | undefined;
      if (r.kode_kegiatan) {
        if (r.buat_kegiatan) {
          const pid = progId ?? (await cariId(supabase, "program", "kode_program", r.kode_program!, tahun));
          if (!pid) throw new Error(`Program ${r.kode_program} tidak ditemukan.`);
          kegId = await pastikan("kegiatan", "kode_kegiatan", r.kode_kegiatan, { nama_kegiatan: r.nama_kegiatan, program_id: pid }, "kegiatanBaru");
        } else {
          kegId = (await cariId(supabase, "kegiatan", "kode_kegiatan", r.kode_kegiatan, tahun)) ?? undefined;
        }
      }
      if (!kegId) throw new Error(`Kegiatan ${r.kode_kegiatan} untuk sub kegiatan ${r.kode_sub_kegiatan} tidak ditemukan.`);
      subId = await pastikan("sub_kegiatan", "kode_sub_kegiatan", r.kode_sub_kegiatan, { nama_sub_kegiatan: r.nama_sub_kegiatan, kegiatan_id: kegId }, "subBaru");
    }

    let rekId = r.rekening_id;
    if (!rekId) {
      const { data: ada } = await supabase.from("rekening_belanja").select("id")
        .eq("sub_kegiatan_id", subId).eq("kode_rekening", r.kode_rekening).eq("sumber_dana", r.sumber_dana).maybeSingle();
      rekId = ada?.id ?? null;
      if (!rekId) {
        const { data, error } = await supabase.from("rekening_belanja").insert({
          sub_kegiatan_id: subId, kode_rekening: r.kode_rekening, jenis_belanja: r.jenis_belanja,
          kelompok_belanja: r.kelompok_belanja, sumber_dana: r.sumber_dana,
        }).select("id").single();
        if (error || !data) throw new Error(`Gagal membuat rekening ${r.kode_rekening}: ${error?.message}`);
        rekId = data.id as string;
        hasil.rekeningBaru += 1;
      }
    }

    const entri = { tahun_anggaran: tahun, tahapan, sumber: "excel" as const, rekening_id: rekId, kode_rekening: r.kode_rekening, sumber_dana: r.sumber_dana, pagu_baru: r.pagu_baru };
    if (r.dpa_id) {
      const patch: Record<string, unknown> = { pagu_anggaran: r.pagu_baru };
      if (r.pptk_id) patch.pptk_id = r.pptk_id;
      const { error } = await supabase.from("dpa").update(patch).eq("id", r.dpa_id);
      if (error) throw new Error(`Gagal memperbarui pagu ${r.kode_rekening}: ${error.message}`);
      hasil.ubah += 1;
      log.push({ ...entri, aksi: "ubah", pagu_lama: r.pagu_lama });
    } else {
      dpaBaru.push({ rekening_id: rekId, tahun_anggaran: tahun, tahapan, pagu_anggaran: r.pagu_baru, pptk_id: r.pptk_id, tanggal_penetapan: tanggalPenetapan });
      dpaBaruLog.push({ ...entri, aksi: "tambah", pagu_lama: null });
      hasil.tambah += 1;
    }
  }

  for (let i = 0; i < dpaBaru.length; i += 500) {
    const { error } = await supabase.from("dpa").upsert(dpaBaru.slice(i, i + 500), { onConflict: "rekening_id,tahun_anggaran,tahapan" });
    if (error) throw new Error(`Gagal menambah pagu: ${error.message}`);
  }
  await catatLog(supabase, [...log, ...dpaBaruLog]);
  return hasil;
}

async function cariId(supabase: SupabaseClient, tabel: string, kolom: string, kode: string, tahun: number): Promise<string | null> {
  const { data } = await supabase.from(tabel).select("id").eq(kolom, kode).eq("tahun_anggaran", tahun).maybeSingle();
  return (data?.id as string) ?? null;
}
