import { createClient } from "@/lib/supabase/server";

export type PegawaiOpt = { id: string; nama: string; nip: string; pangkat_gol: string | null; jabatan: string | null };
export type SbuOpt = { id: string; tujuan: string; uang_harian_rapat: number; uang_harian_diklat: number; uang_harian_perjalanan: number };
export type DpaOpt = {
  id: string; kode_rekening: string; jenis_belanja: string; perjalanan: boolean;
  program: string; kegiatan: string; sub_kegiatan: string; pptk: string;
};

const DPA_SELECT =
  "id, pptk:pejabat_skpd(nama), rekening:rekening_belanja(kode_rekening, jenis_belanja, sub_kegiatan:sub_kegiatan(nama_sub_kegiatan, kegiatan:kegiatan(nama_kegiatan, program:program(nama_program))))";

function toDpaOpt(d: any): DpaOpt {
  const r = d.rekening, sk = r?.sub_kegiatan;
  const kode: string = r?.kode_rekening || "";
  const jenis: string = r?.jenis_belanja || "";
  return {
    id: d.id,
    kode_rekening: kode,
    jenis_belanja: jenis,
    perjalanan: /5\.1\.02\.04\./.test(kode) || /perjalanan dinas/i.test(jenis),
    program: sk?.kegiatan?.program?.nama_program || "-",
    kegiatan: sk?.kegiatan?.nama_kegiatan || "-",
    sub_kegiatan: sk?.nama_sub_kegiatan || "-",
    pptk: d.pptk?.nama || "-",
  };
}

/** Semua referensi untuk formulir -- 3 query berjalan BERSAMAAN. */
export async function loadReferensi(tahun: number, tahapan: string, dpaTerpilih?: string | null) {
  const supabase = await createClient();
  const [pegawai, sbu, dpa, dpaExtra] = await Promise.all([
    supabase.from("perjadin_pegawai").select("id, nama, nip, pangkat_gol, jabatan").order("urut", { nullsFirst: false }).order("nama"),
    supabase.from("perjadin_sbu").select("id, tujuan, uang_harian_rapat, uang_harian_diklat, uang_harian_perjalanan").eq("tahun_anggaran", tahun).order("tujuan"),
    supabase.from("dpa").select(DPA_SELECT).eq("tahun_anggaran", tahun).eq("tahapan", tahapan),
    dpaTerpilih ? supabase.from("dpa").select(DPA_SELECT).eq("id", dpaTerpilih).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const dpaList = (dpa.data ?? []).map(toDpaOpt);
  if (dpaExtra.data && !dpaList.some((d) => d.id === (dpaExtra.data as any).id)) dpaList.push(toDpaOpt(dpaExtra.data));
  dpaList.sort((a, b) => a.kode_rekening.localeCompare(b.kode_rekening));
  return {
    pegawai: (pegawai.data ?? []) as PegawaiOpt[],
    sbu: (sbu.data ?? []).map((s: any) => ({
      ...s,
      uang_harian_rapat: Number(s.uang_harian_rapat),
      uang_harian_diklat: Number(s.uang_harian_diklat),
      uang_harian_perjalanan: Number(s.uang_harian_perjalanan),
    })) as SbuOpt[],
    dpa: dpaList,
    tabelBelumAda: !!(pegawai.error && /perjadin_pegawai/.test(pegawai.error.message)),
  };
}
