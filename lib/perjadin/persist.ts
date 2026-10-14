import type { SupabaseClient } from "@supabase/supabase-js";
import { deteksiJenis, MAKS_UKURAN_BERKAS } from "./extract";
import type { InputPerjadin } from "./simpan";

const BUCKET = "perjalanan-dinas";

async function unggah(
  supabase: SupabaseClient, perjadinId: string, kind: "surat_tugas" | "laporan", f: unknown
): Promise<{ path: string; nama: string } | { error: string } | null> {
  if (!(f instanceof File) || f.size === 0) return null;
  if (f.size > MAKS_UKURAN_BERKAS) return { error: `Berkas ${f.name} melebihi 4 MB.` };
  const buf = Buffer.from(await f.arrayBuffer());
  const jenis = deteksiJenis(f.name, buf);
  if (!jenis) return { error: `Berkas ${f.name} tidak didukung (gunakan .docx, .xlsx/.xls, atau .pdf).` };
  const ext = f.name.toLowerCase().split(".").pop()!.replace(/[^a-z0-9]/g, "");
  const path = `${perjadinId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: f.type || "application/octet-stream", upsert: false,
  });
  if (error) return { error: `Gagal menyimpan berkas ${f.name}: ${error.message}` };
  return { path, nama: f.name.slice(0, 200) };
}

/** Insert (id=null) atau update administrasi perjalanan dinas + peserta + berkas. */
export async function simpanPerjadin(
  supabase: SupabaseClient,
  a: {
    id: string | null; userId: string; input: InputPerjadin; lama: number; tahun: number;
    suratTugas: unknown; laporan: unknown;
  }
): Promise<{ ok: true; id: string; peringatan: string[] } | { ok: false; error: string }> {
  const { input } = a;
  const peringatan: string[] = [];

  const { data: pegawai, error: ePeg } = await supabase
    .from("perjadin_pegawai").select("id, nama, nip, pangkat_gol, jabatan, urut").in("id", input.pegawai_ids);
  if (ePeg) return { ok: false, error: ePeg.message };
  if (!pegawai || pegawai.length === 0) return { ok: false, error: "Pegawai yang dipilih tidak ditemukan." };
  const urutan = new Map(input.pegawai_ids.map((id, i) => [id, i]));
  pegawai.sort((x: any, y: any) => (urutan.get(x.id) ?? 0) - (urutan.get(y.id) ?? 0));

  const baris: Record<string, unknown> = {
    tahun_anggaran: a.tahun,
    nomor_surat_tugas: input.nomor_surat_tugas,
    tanggal_surat_tugas: input.tanggal_surat_tugas,
    maksud: input.maksud,
    tujuan_kota: input.tujuan_kota,
    tujuan_provinsi: input.tujuan_provinsi,
    tanggal_berangkat: input.tanggal_berangkat,
    tanggal_kembali: input.tanggal_kembali,
    lama_hari: a.lama,
    jenis_tarif: input.jenis_tarif,
    tarif_uang_harian: input.tarif_uang_harian,
    biaya_lain: input.biaya_lain,
    dpa_id: input.dpa_id,
    tanggal_kuitansi: input.tanggal_kuitansi,
    nomor_kuitansi: input.nomor_kuitansi,
    updated_at: new Date().toISOString(),
  };
  if (input.hasil_ekstraksi) baris.hasil_ekstraksi = input.hasil_ekstraksi;

  let id = a.id;
  if (id) {
    const { error } = await supabase.from("perjadin").update(baris).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await supabase
      .from("perjadin").insert({ ...baris, dibuat_oleh: a.userId }).select("id").single();
    if (error || !data) return { ok: false, error: error?.message || "Gagal menyimpan." };
    id = data.id as string;
  }

  // Peserta: ganti seluruhnya (snapshot data pegawai saat ini)
  await supabase.from("perjadin_peserta").delete().eq("perjadin_id", id);
  const { error: eIns } = await supabase.from("perjadin_peserta").insert(
    pegawai.map((p: any, i: number) => ({
      perjadin_id: id, pegawai_id: p.id, nama: p.nama, nip: p.nip,
      pangkat_gol: p.pangkat_gol, jabatan: p.jabatan, urut: i,
    }))
  );
  if (eIns) return { ok: false, error: eIns.message };

  // Berkas (kegagalan unggah tidak membatalkan data -- hanya diberi peringatan)
  const patch: Record<string, unknown> = {};
  for (const [kind, f] of [["surat_tugas", a.suratTugas], ["laporan", a.laporan]] as const) {
    const r = await unggah(supabase, id!, kind, f);
    if (!r) continue;
    if ("error" in r) { peringatan.push(r.error); continue; }
    patch[`${kind}_path`] = r.path;
    patch[`${kind}_nama`] = r.nama;
  }
  if (Object.keys(patch).length) await supabase.from("perjadin").update(patch).eq("id", id!);

  return { ok: true, id: id!, peringatan };
}
