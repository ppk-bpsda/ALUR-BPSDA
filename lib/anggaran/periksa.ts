import type { SupabaseClient } from "@supabase/supabase-js";
import { ambilSemua } from "./muat";
import { kelompokDariKode, TAHAPAN_KUNCI, type TahapanKey } from "./pagu";
import { POLA_KODE_BELANJA, rapikanTeks, saranKodeBelanja } from "./kode";

/** Satu rekening (master) beserta pagu di tiap tahapan. */
export type RincianRekening = {
  rekening_id: string;
  kode_rekening: string;
  kode_belanja: string; // 6 segmen terakhir
  uraian: string;
  kelompok: string | null;
  sumber_dana: string;
  sub: { id: string; kode: string; nama: string };
  kegiatan: { kode: string; nama: string };
  program: { kode: string; nama: string };
  pagu: Partial<Record<TahapanKey, number>>;
};

/** Siapa/kapan/dari mana pagu suatu tahapan pertama kali dibuat (dari riwayat otomatis). */
export type AsalPagu = { username: string | null; waktu: string; sumber: string; berkas: string | null; baris: number | null };

export type Masalah = {
  tingkat: "galat" | "periksa" | "info";
  jenis: string;
  pesan: string;
  rekening: RincianRekening;
  tahapan?: TahapanKey;
};

export async function muatRincian(supabase: SupabaseClient, tahun: number): Promise<RincianRekening[]> {
  const [rek, dpa] = await Promise.all([
    ambilSemua<any>((a, b) =>
      supabase.from("rekening_belanja")
        .select("id, kode_rekening, jenis_belanja, kelompok_belanja, sumber_dana, sub_kegiatan!inner(id, kode_sub_kegiatan, nama_sub_kegiatan, tahun_anggaran, kegiatan!inner(kode_kegiatan, nama_kegiatan, program!inner(kode_program, nama_program)))")
        .eq("sub_kegiatan.tahun_anggaran", tahun).order("id").range(a, b)),
    ambilSemua<any>((a, b) => supabase.from("dpa").select("rekening_id, tahapan, pagu_anggaran").eq("tahun_anggaran", tahun).order("id").range(a, b)),
  ]);
  const pagu = new Map<string, Partial<Record<TahapanKey, number>>>();
  for (const d of dpa) {
    const m = pagu.get(d.rekening_id) ?? {};
    m[d.tahapan as TahapanKey] = Number(d.pagu_anggaran);
    pagu.set(d.rekening_id, m);
  }
  return rek
    .map((r: any): RincianRekening => {
      const sk = r.sub_kegiatan, kg = sk?.kegiatan, pg = kg?.program;
      return {
        rekening_id: r.id,
        kode_rekening: r.kode_rekening,
        kode_belanja: String(r.kode_rekening).slice(-19),
        uraian: rapikanTeks(r.jenis_belanja),
        kelompok: r.kelompok_belanja ?? null,
        sumber_dana: rapikanTeks(r.sumber_dana),
        sub: { id: sk?.id, kode: sk?.kode_sub_kegiatan ?? "", nama: sk?.nama_sub_kegiatan ?? "" },
        kegiatan: { kode: kg?.kode_kegiatan ?? "", nama: kg?.nama_kegiatan ?? "" },
        program: { kode: pg?.kode_program ?? "", nama: pg?.nama_program ?? "" },
        pagu: pagu.get(r.id) ?? {},
      };
    })
    .sort((a, b) => a.sub.kode.localeCompare(b.sub.kode) || a.kode_rekening.localeCompare(b.kode_rekening) || a.sumber_dana.localeCompare(b.sumber_dana));
}

/** Asal pembuatan pagu per (rekening, tahapan). Kosong bila riwayat belum aktif / data dibuat sebelum riwayat ada. */
export async function muatAsalPagu(supabase: SupabaseClient, tahun: number): Promise<Map<string, AsalPagu>> {
  const hasil = new Map<string, AsalPagu>();
  try {
    const log = await ambilSemua<any>((a, b) =>
      supabase.from("anggaran_log")
        .select("id, created_at, username, sumber, tahapan, rekening_id, nama_berkas, nomor_baris")
        .eq("tahun_anggaran", tahun).eq("aksi", "tambah").or("tabel.eq.dpa,tabel.is.null")
        .order("created_at", { ascending: true }).range(a, b));
    for (const l of log) {
      if (!l.rekening_id) continue;
      const k = `${l.rekening_id}|${l.tahapan}`;
      if (!hasil.has(k)) hasil.set(k, { username: l.username, waktu: l.created_at, sumber: l.sumber, berkas: l.nama_berkas ?? null, baris: l.nomor_baris ?? null });
    }
  } catch { /* migrasi riwayat belum dijalankan */ }
  return hasil;
}

/** Status perpindahan antartahapan untuk satu rekening. */
export function statusAntarTahapan(p: Partial<Record<TahapanKey, number>>) {
  const ada = (t: TahapanKey) => p[t] !== undefined;
  const hasil: { baruDi?: TahapanKey; hilangDi?: TahapanKey } = {};
  const urut = TAHAPAN_KUNCI;
  for (let i = 1; i < urut.length; i++) {
    const sebelumnya = urut.slice(0, i).some(ada);
    if (ada(urut[i]) && !sebelumnya && !hasil.baruDi) hasil.baruDi = urut[i];
    // pernah ada di tahapan sebelumnya, tetapi tidak ada di tahapan ini (padahal tahapan ini sudah berisi data lain)
    if (!ada(urut[i]) && ada(urut[i - 1]) && !hasil.hilangDi) hasil.hilangDi = urut[i];
  }
  return hasil;
}

/**
 * Pemeriksaan kesalahan input pagu. Setiap temuan menyebut rekening yang bermasalah supaya bisa
 * langsung diperbaiki. `tahapanBerisi` = tahapan yang memang sudah punya data (agar rekening yang
 * "belum dibawa" hanya dilaporkan untuk tahapan yang sudah diisi).
 */
export function periksaData(
  rincian: RincianRekening[],
  katalog: Map<string, string>
): Masalah[] {
  const m: Masalah[] = [];
  const tahapanBerisi = new Set<TahapanKey>();
  for (const r of rincian) for (const t of TAHAPAN_KUNCI) if (r.pagu[t] !== undefined) tahapanBerisi.add(t);

  const tambah = (tingkat: Masalah["tingkat"], jenis: string, pesan: string, rekening: RincianRekening, tahapan?: TahapanKey) =>
    m.push({ tingkat, jenis, pesan, rekening, tahapan });

  const perSubKode = new Map<string, RincianRekening[]>();
  for (const r of rincian) {
    const k = `${r.sub.id}|${r.kode_rekening}`;
    perSubKode.set(k, [...(perSubKode.get(k) ?? []), r]);
  }

  for (const r of rincian) {
    // 1. struktur kode
    const awalan = r.sub.kode ? `${r.sub.kode}.` : "";
    if (awalan && !r.kode_rekening.startsWith(awalan)) {
      tambah("galat", "Kode tidak sesuai sub kegiatan", `Kode rekening tidak berawalan kode sub kegiatan ${r.sub.kode}. Kode salah ketik atau rekening salah tempat.`, r);
    } else if (!POLA_KODE_BELANJA.test(awalan ? r.kode_rekening.slice(awalan.length) : r.kode_belanja)) {
      tambah("galat", "Format kode salah", "Bagian kode belanja harus 6 segmen (X.X.XX.XX.XXX.XXXXX).", r);
    }

    // 2. kode & uraian dibanding katalog resmi
    if (katalog.size > 0 && POLA_KODE_BELANJA.test(r.kode_belanja)) {
      const nama = katalog.get(r.kode_belanja);
      if (!nama) {
        const saran = saranKodeBelanja(r.kode_belanja, katalog.keys());
        tambah("periksa", "Kode di luar katalog",
          `Kode belanja ${r.kode_belanja} tidak ada di katalog resmi.` + (saran.length ? ` Mungkin maksudnya: ${saran.map((k) => `${k} (${katalog.get(k)})`).join("; ")}.` : ""), r);
      } else if (nama.trim().toLowerCase() !== r.uraian.toLowerCase()) {
        tambah("periksa", "Uraian tidak sama dengan katalog", `Uraian "${r.uraian}" berbeda dari katalog untuk kode ini: "${nama}". Salah kode atau salah uraian?`, r);
      }
    }

    // 3. kelompok belanja tidak cocok dengan kode (5.2 = Belanja Modal)
    if (POLA_KODE_BELANJA.test(r.kode_belanja) && r.kelompok) {
      const seharusnya = kelompokDariKode(r.kode_belanja, "");
      const modal = /modal/i.test(r.kelompok);
      if ((seharusnya === "Belanja Modal") !== modal) {
        tambah("periksa", "Kelompok belanja janggal", `Kelompok "${r.kelompok}" tidak lazim untuk kode ${r.kode_belanja} (seharusnya ${seharusnya}).`, r);
      }
    }

    // 4. perpindahan antartahapan
    const st = statusAntarTahapan(r.pagu);
    if (st.baruDi) tambah("info", "Belanja baru", `Belanja BARU di ${st.baruDi} (belum ada di tahapan sebelumnya). Pastikan memang usulan baru, bukan salah kode dari belanja yang sudah ada.`, r, st.baruDi);
    if (st.hilangDi && tahapanBerisi.has(st.hilangDi)) {
      tambah("periksa", "Belanja tidak dibawa", `Ada di tahapan sebelumnya tetapi TIDAK ada di ${st.hilangDi}. Lupa disalin, atau kodenya diganti sehingga terbaca belanja baru di baris lain?`, r, st.hilangDi);
    }
    // 5. pagu nol padahal tahapan lain berisi
    for (const t of TAHAPAN_KUNCI) {
      if (r.pagu[t] === 0 && TAHAPAN_KUNCI.some((x) => x !== t && (r.pagu[x] ?? 0) > 0)) {
        tambah("info", "Pagu nol", `Pagu ${t} Rp 0 padahal tahapan lain berisi. Disengaja (dihapus) atau lupa diisi?`, r, t);
      }
    }
  }

  // 6. kode sama dengan sumber dana berbeda, dan sumber dana yang hanya beda huruf/spasi (rekening dobel)
  for (const daftar of perSubKode.values()) {
    if (daftar.length < 2) continue;
    const kanon = new Map<string, RincianRekening[]>();
    for (const r of daftar) kanon.set(r.sumber_dana.toLowerCase(), [...(kanon.get(r.sumber_dana.toLowerCase()) ?? []), r]);
    for (const r of daftar) {
      if ((kanon.get(r.sumber_dana.toLowerCase()) ?? []).length > 1) {
        tambah("galat", "Rekening dobel", `Kode ini terdaftar lebih dari sekali dengan sumber dana yang hanya beda penulisan (${daftar.map((x) => `"${x.sumber_dana}"`).join(", ")}). Gabungkan menjadi satu.`, r);
      } else {
        tambah("info", "Kode sama, sumber dana berbeda", `Kode ini juga ada dengan sumber dana ${daftar.filter((x) => x !== r).map((x) => x.sumber_dana).join(", ")}. Wajar bila anggarannya memang terpisah per sumber dana.`, r);
      }
    }
  }
  return m;
}
