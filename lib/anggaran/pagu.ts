import * as XLSX from "xlsx";
import { round2 } from "@/lib/pengajuanValidation";
import { parseAngka } from "./angka";
import { bersihkanKode, periksaKode, rapikanTeks, saranKodeBelanja, POLA_KODE_BELANJA } from "./kode";

export { parseAngka, POLA_KODE_BELANJA };

/**
 * Inti logika "update pagu sesuai tahapan anggaran" lewat Excel.
 * Fungsi di sini MURNI (tanpa database): menerima isi file + data acuan,
 * mengembalikan rencana perubahan. Dipakai route pratinjau & simpan yang sama,
 * sehingga yang dilihat di pratinjau persis yang akan disimpan.
 *
 * FORMAT TETAP (satu berkas untuk seluruh tahapan):
 *   satu baris = satu rekening (sub kegiatan + kode + sumber dana);
 *   tiga kolom pagu: pagu_murni | pagu_pergeseran | pagu_perubahan.
 *   Saat impor HANYA kolom tahapan aktif yang dibaca & disimpan; kolom tahapan
 *   lain hanya dibandingkan (bila beda dari database, diberi peringatan).
 *   Berkas lama dengan satu kolom `pagu_anggaran` tetap diterima.
 */

export type TahapanKey = "murni" | "pergeseran" | "perubahan";
export const TAHAPAN_KUNCI: TahapanKey[] = ["murni", "pergeseran", "perubahan"];
export const TAHAPAN_URUT: Record<string, number> = { murni: 1, pergeseran: 2, perubahan: 3 };

export const MAKS_BARIS = 5000;

/** Urutan & nama kolom pada FORMAT TETAP (dipakai unduhan format & pembacaan). */
export const KOLOM_FORMAT = [
  "kode_program", "nama_program", "kode_kegiatan", "nama_kegiatan",
  "kode_sub_kegiatan", "nama_sub_kegiatan",
  "kode_rekening", "uraian_belanja", "kelompok_belanja", "sumber_dana",
  "pagu_murni", "pagu_pergeseran", "pagu_perubahan",
  "nama_pptk", "id_rekening",
] as const;

// ------------------------------------------------------------------ tipe
export type SelPagu = { mentah: unknown; nilai: number | null };

export type BarisFile = {
  baris: number; // nomor baris di Excel
  kode_program?: string;
  nama_program?: string;
  kode_kegiatan?: string;
  nama_kegiatan?: string;
  kode_sub_kegiatan?: string;
  nama_sub_kegiatan?: string;
  kode_rekening?: string;
  jenis_belanja?: string;
  kelompok_belanja?: string;
  sumber_dana?: string;
  nama_pptk?: string;
  id_rekening?: string;
  pagu: Partial<Record<TahapanKey | "umum", SelPagu>>;
};

export type StatusBaris = "baru" | "ubah" | "sama" | "koreksi" | "lewati" | "galat";

export type RencanaBaris = {
  baris: number;
  status: StatusBaris;
  kode_sub_kegiatan: string;
  kode_rekening: string; // lengkap
  sumber_dana: string;
  jenis_belanja: string;
  kelompok_belanja: string;
  nama_sub_kegiatan?: string;
  nama_kegiatan?: string;
  kode_kegiatan?: string;
  nama_program?: string;
  kode_program?: string;
  pagu_lama: number | null;
  pagu_baru: number;
  selisih: number;
  realisasi: number;
  rekening_id: string | null; // null = rekening master baru
  dpa_id: string | null;
  sub_kegiatan_id: string | null; // null = sub kegiatan baru
  pptk_id: string | null;
  buat_sub_kegiatan: boolean;
  buat_kegiatan: boolean;
  buat_program: boolean;
  /** true = ubah master rekening yang sudah ada (kode/uraian/sumber dana/sub kegiatan) */
  koreksi: boolean;
  /** rincian koreksi, mis. "kode_rekening: A → B" */
  rincianKoreksi: string[];
  /** perlu dicentang "sudah saya periksa" sebelum simpan (rekening baru di luar katalog / koreksi master) */
  perluKonfirmasi: boolean;
  /** kode katalog yang mirip (untuk saran salah ketik) */
  saran: string[];
  peringatan: string[];
  galat: string[];
};

export type DataAcuan = {
  programs: { id: string; kode_program: string }[];
  kegiatan: { id: string; kode_kegiatan: string; program_id: string }[];
  subs: { id: string; kode_sub_kegiatan: string; kegiatan_id: string }[];
  rekening: {
    id: string; sub_kegiatan_id: string; kode_rekening: string; sumber_dana: string;
    jenis_belanja: string; kelompok_belanja: string | null;
  }[];
  /** dpa di tahapan TUJUAN, per rekening_id */
  dpaTujuan: Map<string, { id: string; pagu_anggaran: number; pptk_id: string | null }>;
  /** pagu tiap tahapan per rekening_id (untuk membandingkan kolom tahapan lain di berkas) */
  dpaSemua: Map<string, Partial<Record<TahapanKey, number>>>;
  /** pptk_id dari tahapan lain (dipakai mewarisi PPTK untuk baris baru), per rekening_id */
  pptkWarisan: Map<string, string>;
  pptk: { id: string; nama: string; sub_kegiatan_id: string | null }[];
  /** realisasi (status dicairkan) terakumulasi s/d tahapan tujuan, per rekening_id */
  realisasi: Map<string, number>;
  /** katalog kode belanja resmi: kode (6 segmen) -> nama. Kosong bila tabel katalog belum ada. */
  katalogBelanja: Map<string, string>;
  /** katalog sumber dana */
  sumberDana: string[];
};

// --------------------------------------------------------------- utilitas
const norm = (s: unknown) => String(s ?? "").trim();
const lc = (s: unknown) => rapikanTeks(s).toLowerCase();
const rp = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n || 0));

export function kelompokDariKode(kodeBelanja: string, teks?: string): string {
  if (/modal/i.test(teks || "")) return "Belanja Modal";
  if (/barang|jasa/i.test(teks || "")) return "Belanja Barang/Jasa";
  return kodeBelanja.startsWith("5.2.") ? "Belanja Modal" : "Belanja Barang/Jasa";
}

// Nama kolom yang diterima (huruf besar/kecil, spasi, tanda baca diabaikan).
type KunciKolom =
  | keyof Omit<BarisFile, "baris" | "pagu">
  | "pagu_murni" | "pagu_pergeseran" | "pagu_perubahan" | "pagu_umum";
const ALIAS: Record<string, KunciKolom> = {
  kode_program: "kode_program", nama_program: "nama_program",
  kode_kegiatan: "kode_kegiatan", nama_kegiatan: "nama_kegiatan",
  kode_sub_kegiatan: "kode_sub_kegiatan", kode_subkegiatan: "kode_sub_kegiatan", nama_sub_kegiatan: "nama_sub_kegiatan",
  kode_rekening: "kode_rekening", kode_rekening_lengkap: "kode_rekening", kode_rekening_belanja: "kode_rekening", rekening: "kode_rekening",
  jenis_belanja: "jenis_belanja", uraian_belanja: "jenis_belanja", uraian: "jenis_belanja", nama_rekening: "jenis_belanja",
  kelompok_belanja: "kelompok_belanja", jenis_rek: "kelompok_belanja",
  sumber_dana: "sumber_dana",
  pagu_murni: "pagu_murni", murni: "pagu_murni",
  pagu_pergeseran: "pagu_pergeseran", pergeseran: "pagu_pergeseran",
  pagu_perubahan: "pagu_perubahan", perubahan: "pagu_perubahan",
  pagu_anggaran: "pagu_umum", pagu: "pagu_umum", anggaran: "pagu_umum",
  nama_pptk: "nama_pptk", pptk: "nama_pptk",
  id_rekening: "id_rekening", id_rekening_jangan_diubah: "id_rekening",
};
const kunci = (h: unknown) => lc(h).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const KOLOM_PAGU = new Set<KunciKolom>(["pagu_murni", "pagu_pergeseran", "pagu_perubahan", "pagu_umum"]);
const BARIS_JUMLAH = /^(jumlah|total|sub\s?total|grand\s?total)\b/i;

/** Baca workbook -> daftar baris. Mengembalikan galat umum (bukan per baris) bila format tidak cocok. */
export function bacaWorkbook(buf: Buffer): { baris: BarisFile[]; galat?: string } {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  } catch (e: any) {
    return { baris: [], galat: "File tidak bisa dibaca sebagai Excel (.xlsx): " + (e?.message || "") };
  }
  const bacaSheet = (n: string) => XLSX.utils.sheet_to_json<any[]>(wb.Sheets[n], { header: 1, defval: "", blankrows: false });
  const cariHeader = (rows: any[][]) => {
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const ks = rows[i].map(kunci).map((k: string) => ALIAS[k]);
      if (ks.includes("kode_rekening") && ks.some((k) => k && KOLOM_PAGU.has(k))) return i;
    }
    return -1;
  };

  // Pilih sheet "Pagu" bila ada; selain itu sheet pertama yang punya judul kolom kode_rekening + pagu.
  const namaSheet = wb.SheetNames.find((n) => lc(n) === "pagu") ?? wb.SheetNames.find((n) => cariHeader(bacaSheet(n)) >= 0);
  if (!namaSheet) {
    return { baris: [], galat: "Sheet 'Pagu' tidak ditemukan. Gunakan berkas dari tombol \"Unduh format isian\"." };
  }
  const rows = bacaSheet(namaSheet);
  const idxHeader = cariHeader(rows);
  if (idxHeader < 0) {
    return { baris: [], galat: "Judul kolom tidak ditemukan. Minimal harus ada kolom kode_rekening dan kolom pagu (pagu_murni / pagu_pergeseran / pagu_perubahan)." };
  }
  const peta: (KunciKolom | null)[] = rows[idxHeader].map((h: unknown) => ALIAS[kunci(h)] ?? null);

  const out: BarisFile[] = [];
  for (let i = idxHeader + 1; i < rows.length; i++) {
    const r = rows[i];
    const obj: any = { baris: i + 1, pagu: {} };
    let adaIsi = false;
    let barisJumlah = false;
    peta.forEach((k, c) => {
      const v = r[c];
      if (typeof v === "string" && BARIS_JUMLAH.test(v.trim())) barisJumlah = true;
      if (!k) return;
      if (norm(v) !== "") adaIsi = true;
      if (k === "pagu_murni" || k === "pagu_pergeseran" || k === "pagu_perubahan" || k === "pagu_umum") {
        const t = k === "pagu_umum" ? "umum" : (k.slice(5) as TahapanKey);
        obj.pagu[t] = { mentah: v, nilai: parseAngka(v) } as SelPagu;
      } else obj[k] = norm(v);
    });
    if (barisJumlah && !norm(obj.kode_rekening) && !norm(obj.id_rekening)) continue; // baris total buatan pengguna
    if (adaIsi) out.push(obj as BarisFile);
  }
  return { baris: out };
}

// ----------------------------------------------------------- rencana
export function susunRencana(baris: BarisFile[], ref: DataAcuan, tahapan: string): RencanaBaris[] {
  const subByKode = new Map(ref.subs.map((s) => [s.kode_sub_kegiatan, s]));
  const kegByKode = new Map(ref.kegiatan.map((k) => [k.kode_kegiatan, k]));
  const progByKode = new Map(ref.programs.map((p) => [p.kode_program, p]));
  const rekById = new Map(ref.rekening.map((r) => [r.id, r]));
  const rekByKunci = new Map(ref.rekening.map((r) => [`${r.sub_kegiatan_id}|${r.kode_rekening}|${lc(r.sumber_dana)}`, r]));
  const rekBySubKode = new Map<string, DataAcuan["rekening"]>();
  for (const r of ref.rekening) {
    const k = `${r.sub_kegiatan_id}|${r.kode_rekening}`;
    rekBySubKode.set(k, [...(rekBySubKode.get(k) ?? []), r]);
  }
  // penulisan sumber dana baku: katalog dulu, lalu yang sudah terpakai
  const sumberBaku = new Map<string, string>();
  for (const s of ref.sumberDana) if (!sumberBaku.has(lc(s))) sumberBaku.set(lc(s), rapikanTeks(s));
  for (const r of ref.rekening) if (!sumberBaku.has(lc(r.sumber_dana))) sumberBaku.set(lc(r.sumber_dana), rapikanTeks(r.sumber_dana));

  const tKey = tahapan as TahapanKey;
  const sudahDiFile = new Map<string, number>(); // kunci -> nomor baris pertama
  const idSudah = new Map<string, number>();
  const out: RencanaBaris[] = [];

  for (const b of baris) {
    const galat: string[] = [];
    const peringatan: string[] = [];
    const rincianKoreksi: string[] = [];
    let saran: string[] = [];
    let perluKonfirmasi = false;

    // --- pagu untuk tahapan aktif (kolom khusus tahapan; jika tak ada, kolom pagu_anggaran lama)
    const sel = b.pagu[tKey] ?? b.pagu.umum;
    const kosong = !sel || norm(sel.mentah) === "";

    // --- id_rekening (bila berkas berasal dari unduhan format)
    const idFile = norm(b.id_rekening);
    const rekDariId = idFile ? rekById.get(idFile) : undefined;
    if (idFile && !rekDariId) galat.push(`id_rekening '${idFile}' tidak ditemukan di database (kolom ini jangan diubah/ditempel dari file lain)`);
    if (idFile) {
      const pertama = idSudah.get(idFile);
      if (pertama) galat.push(`id_rekening sama dengan baris ${pertama} (baris terduplikasi)`);
      else idSudah.set(idFile, b.baris);
    }

    // --- kode rekening lengkap & kode sub kegiatan
    const kodeMasuk = norm(b.kode_rekening);
    const hk = periksaKode(kodeMasuk, b.kode_sub_kegiatan);
    if (!hk.ok) galat.push(hk.galat!);
    const kodeRek = hk.ok ? hk.kode : bersihkanKode(kodeMasuk);
    const kodeSub = hk.ok ? hk.kodeSub : bersihkanKode(b.kode_sub_kegiatan);
    const kodeBelanja = hk.ok ? hk.kodeBelanja : "";

    // --- sumber dana (penulisan dibakukan; beda huruf besar/kecil/spasi tidak membuat rekening dobel)
    const sumberMasuk = rapikanTeks(b.sumber_dana);
    if (!sumberMasuk) galat.push("sumber_dana kosong");
    const sumber = sumberBaku.get(lc(sumberMasuk)) ?? sumberMasuk;
    if (sumberMasuk && !sumberBaku.has(lc(sumberMasuk))) {
      peringatan.push(`Sumber dana '${sumberMasuk}' belum pernah dipakai/terdaftar -- pastikan penulisannya benar.`);
    }

    // --- nilai pagu
    let pagu: number | null = null;
    if (!kosong) {
      pagu = sel!.nilai;
      if (pagu === null) galat.push(`pagu '${norm(sel!.mentah)}' bukan angka`);
      else if (pagu < 0) galat.push("pagu tidak boleh negatif");
      else pagu = round2(pagu);
    }

    // --- hierarki
    const sub = kodeSub ? subByKode.get(kodeSub) : undefined;
    let buatSub = false, buatKeg = false, buatProg = false;
    let kodeKeg = norm(b.kode_kegiatan);
    let kodeProg = norm(b.kode_program);
    if (kodeSub && !sub) {
      const bagian = kodeSub.split(".");
      if (!kodeKeg && bagian.length >= 2) kodeKeg = bagian.slice(0, -1).join(".");
      if (!kodeProg && bagian.length >= 3) kodeProg = bagian.slice(0, 3).join(".");
      if (!norm(b.nama_sub_kegiatan)) {
        galat.push(`Sub kegiatan ${kodeSub} belum ada (salah ketik?). Isi kolom nama_sub_kegiatan agar dibuat otomatis, atau perbaiki kodenya.`);
      } else {
        buatSub = true;
        const keg = kegByKode.get(kodeKeg);
        if (!keg) {
          if (!norm(b.nama_kegiatan)) galat.push(`Kegiatan ${kodeKeg} belum ada. Isi kolom nama_kegiatan.`);
          else {
            buatKeg = true;
            if (!progByKode.get(kodeProg)) {
              if (!norm(b.nama_program)) galat.push(`Program ${kodeProg} belum ada. Isi kolom nama_program.`);
              else buatProg = true;
            }
          }
        }
      }
    }

    // --- rekening master: lewat id_rekening (koreksi) atau lewat kunci kode + sumber dana
    const uraian = rapikanTeks(b.jenis_belanja);
    const kelompokFile = rapikanTeks(b.kelompok_belanja);
    let rek = rekDariId;
    let koreksi = false;
    if (!rek && !idFile && sub) rek = rekByKunci.get(`${sub.id}|${kodeRek}|${lc(sumber)}`);

    if (rek && rekDariId && !galat.length) {
      // berkas menunjuk rekening tertentu: setiap beda pada identitas = koreksi master (berlaku untuk SEMUA tahapan)
      if (rek.kode_rekening !== kodeRek) rincianKoreksi.push(`kode_rekening: ${rek.kode_rekening} → ${kodeRek}`);
      if (lc(rek.sumber_dana) !== lc(sumber)) rincianKoreksi.push(`sumber_dana: ${rek.sumber_dana} → ${sumber}`);
      if (sub ? rek.sub_kegiatan_id !== sub.id : !!kodeSub) rincianKoreksi.push(`sub_kegiatan: pindah ke ${kodeSub}${sub ? "" : " (baru)"}`);
      if (uraian && rapikanTeks(rek.jenis_belanja) !== uraian) rincianKoreksi.push(`uraian: ${rapikanTeks(rek.jenis_belanja)} → ${uraian}`);
      if (kelompokFile && (rek.kelompok_belanja ?? "") !== kelompokFile) rincianKoreksi.push(`kelompok_belanja: ${rek.kelompok_belanja ?? "-"} → ${kelompokFile}`);
      if (rincianKoreksi.length) {
        koreksi = true;
        perluKonfirmasi = true;
        if (sub) {
          const tabrak = rekByKunci.get(`${sub.id}|${kodeRek}|${lc(sumber)}`);
          if (tabrak && tabrak.id !== rek.id) galat.push(`Koreksi ditolak: kode ${kodeRek} + sumber dana ${sumber} sudah dipakai rekening lain. Hapus/gabungkan lewat menu Rekening & Pagu.`);
        }
        peringatan.push("KOREKSI MASTER REKENING -- berlaku untuk semua tahapan dan tercatat di riwayat.");
        if (kodeBelanja && rek.kode_rekening.slice(-19) !== kodeBelanja && ref.katalogBelanja.size > 0 && !ref.katalogBelanja.has(kodeBelanja)) {
          saran = saranKodeBelanja(kodeBelanja, ref.katalogBelanja.keys());
          peringatan.push(`Kode belanja ${kodeBelanja} tidak ada di katalog resmi.`);
        }
      }
    }

    // --- rekening BARU: periksa kemungkinan salah ketik sebelum membuat master baru
    if (!rek && !galat.length) {
      if (!uraian) galat.push("Rekening baru: kolom uraian_belanja wajib diisi.");
      if (sub) {
        const serupa = rekBySubKode.get(`${sub.id}|${kodeRek}`) ?? [];
        if (serupa.length) {
          peringatan.push(`Kode ini sudah ada dengan sumber dana ${serupa.map((s) => s.sumber_dana).join(", ")}; baris ini membuat rekening BARU bersumber dana ${sumber}. Pastikan sumber dana tidak salah.`);
          perluKonfirmasi = true;
        }
      }
      if (ref.katalogBelanja.size > 0) {
        const namaKatalog = ref.katalogBelanja.get(kodeBelanja);
        if (!namaKatalog) {
          saran = saranKodeBelanja(kodeBelanja, ref.katalogBelanja.keys());
          peringatan.push(
            `Kode belanja ${kodeBelanja} TIDAK ADA di katalog resmi -- periksa salah ketik.` +
              (saran.length ? ` Mungkin maksudnya: ${saran.map((k) => `${k} (${ref.katalogBelanja.get(k)})`).join("; ")}.` : "")
          );
          perluKonfirmasi = true;
        } else if (uraian && lc(namaKatalog) !== lc(uraian)) {
          peringatan.push(`Uraian berbeda dari katalog untuk ${kodeBelanja}: katalog menulis "${namaKatalog}".`);
        }
      }
      if (!galat.length) peringatan.push("Rekening baru akan dibuat.");
    }

    // --- duplikat dalam file
    if (kodeRek && sumber && hk.ok) {
      const kunciFile = `${kodeSub}|${kodeRek}|${lc(sumber)}`;
      const pertama = sudahDiFile.get(kunciFile);
      if (pertama) galat.push(`Duplikat dengan baris ${pertama} (rekening + sumber dana yang sama)`);
      else sudahDiFile.set(kunciFile, b.baris);
    }

    // --- DPA tujuan, realisasi, PPTK
    const dpa = rek ? ref.dpaTujuan.get(rek.id) : undefined;
    const realisasi = rek ? round2(ref.realisasi.get(rek.id) ?? 0) : 0;
    let pptkId: string | null = dpa?.pptk_id ?? null;
    const namaPptk = rapikanTeks(b.nama_pptk);
    if (namaPptk) {
      const kandidat = ref.pptk.filter((p) => lc(p.nama) === lc(namaPptk));
      const cocok = kandidat.find((p) => sub && p.sub_kegiatan_id === sub.id) ?? kandidat[0];
      if (cocok) pptkId = cocok.id;
      else peringatan.push(`PPTK '${namaPptk}' belum terdaftar di menu Pejabat -- PPTK tidak diubah.`);
    } else if (!pptkId && rek) {
      pptkId = ref.pptkWarisan.get(rek.id) ?? null; // baris baru mewarisi PPTK tahapan sebelumnya
    }

    // --- kolom tahapan LAIN di berkas dibandingkan dengan database (tidak diimpor)
    if (rek && !galat.length) {
      for (const t of TAHAPAN_KUNCI) {
        if (t === tKey) continue;
        const s = b.pagu[t];
        if (!s || norm(s.mentah) === "" || s.nilai === null) continue;
        const db = ref.dpaSemua.get(rek.id)?.[t];
        if (db === undefined ? s.nilai !== 0 : Math.abs(db - s.nilai) >= 0.005) {
          peringatan.push(`Kolom pagu_${t} di berkas (${rp(s.nilai)}) berbeda dari database (${db === undefined ? "belum ada" : rp(db)}) -- kolom ini TIDAK diimpor.`);
        }
      }
    }

    const paguBaru = pagu ?? 0;
    const paguLama = dpa ? Number(dpa.pagu_anggaran) : null;
    if (!galat.length && !kosong && paguBaru < realisasi) {
      peringatan.push(`Pagu lebih kecil dari realisasi yang sudah tercatat (Rp ${rp(realisasi)}) -- sisa anggaran akan negatif.`);
    }
    if (!galat.length && buatSub) peringatan.push("Sub kegiatan baru akan dibuat" + (buatKeg ? " (beserta kegiatan" + (buatProg ? " & program" : "") + ")" : "") + ".");

    let status: StatusBaris;
    if (galat.length) status = "galat";
    else if (kosong) status = "lewati";
    else if (koreksi) status = "koreksi";
    else if (paguLama === null) status = "baru";
    else if (Math.abs(paguLama - paguBaru) < 0.005 && (!namaPptk || pptkId === dpa?.pptk_id)) status = "sama";
    else status = "ubah";

    if (status === "lewati") {
      peringatan.length = 0;
      perluKonfirmasi = false;
      peringatan.push(`Pagu ${tKey} kosong -- baris dilewati (tidak diubah).`);
    }

    out.push({
      baris: b.baris,
      status,
      kode_sub_kegiatan: kodeSub,
      kode_rekening: kodeRek,
      sumber_dana: sumber,
      jenis_belanja: uraian || rek?.jenis_belanja || "",
      kelompok_belanja: kelompokFile || rek?.kelompok_belanja || kelompokDariKode(kodeBelanja || kodeRek.slice(-19), ""),
      nama_sub_kegiatan: norm(b.nama_sub_kegiatan) || undefined,
      nama_kegiatan: norm(b.nama_kegiatan) || undefined,
      kode_kegiatan: kodeKeg || undefined,
      nama_program: norm(b.nama_program) || undefined,
      kode_program: kodeProg || undefined,
      pagu_lama: paguLama,
      pagu_baru: paguBaru,
      selisih: status === "lewati" ? 0 : round2(paguBaru - (paguLama ?? 0)),
      realisasi,
      rekening_id: rek?.id ?? null,
      dpa_id: dpa?.id ?? null,
      sub_kegiatan_id: sub?.id ?? null,
      pptk_id: pptkId,
      buat_sub_kegiatan: buatSub,
      buat_kegiatan: buatKeg,
      buat_program: buatProg,
      koreksi,
      rincianKoreksi,
      perluKonfirmasi,
      saran,
      peringatan,
      galat,
    });
  }
  return out;
}

// ---------------------------------------------------------- ringkasan
export type Ringkasan = {
  total: number; baru: number; ubah: number; sama: number; koreksi: number; lewati: number; galat: number;
  subBaru: number; selisih: number;
  /** jumlah baris yang harus dicentang "sudah saya periksa" sebelum simpan */
  perluKonfirmasi: number;
  /** rekening yang punya pagu di tahapan ini tetapi tidak ada di berkas (TIDAK dihapus -- hanya info) */
  tidakDiBerkas: number;
};

export function ringkasRencana(rencana: RencanaBaris[], ref: DataAcuan): Ringkasan {
  const hitung = (s: StatusBaris) => rencana.filter((r) => r.status === s).length;
  const disentuh = new Set(rencana.map((r) => r.rekening_id).filter(Boolean) as string[]);
  let tidakDiBerkas = 0;
  for (const id of ref.dpaTujuan.keys()) if (!disentuh.has(id)) tidakDiBerkas += 1;
  return {
    total: rencana.length,
    baru: hitung("baru"), ubah: hitung("ubah"), sama: hitung("sama"),
    koreksi: hitung("koreksi"), lewati: hitung("lewati"), galat: hitung("galat"),
    subBaru: new Set(rencana.filter((r) => r.buat_sub_kegiatan).map((r) => r.kode_sub_kegiatan)).size,
    selisih: round2(rencana.reduce((s, r) => (r.status === "galat" || r.status === "lewati" ? s : s + r.selisih), 0)),
    perluKonfirmasi: rencana.filter((r) => r.perluKonfirmasi && r.status !== "galat" && r.status !== "lewati").length,
    tidakDiBerkas,
  };
}
