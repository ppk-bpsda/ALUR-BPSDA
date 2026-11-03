import * as XLSX from "xlsx";
import { round2 } from "@/lib/pengajuanValidation";
import { parseAngka } from "./angka";

export { parseAngka };

/**
 * Inti logika "update pagu sesuai tahapan anggaran" lewat Excel.
 * Fungsi di sini MURNI (tanpa database): menerima isi file + data acuan,
 * mengembalikan rencana perubahan. Dipakai route pratinjau & simpan yang sama,
 * sehingga yang dilihat di pratinjau persis yang akan disimpan.
 */

export const TAHAPAN_URUT: Record<string, number> = { murni: 1, pergeseran: 2, perubahan: 3 };

// Kode rekening belanja saja (6 segmen), mis. 5.1.02.01.001.00024
export const POLA_KODE_BELANJA = /^\d\.\d\.\d{2}\.\d{2}\.\d{3}\.\d{5}$/;

export const MAKS_BARIS = 3000;

// ------------------------------------------------------------------ tipe
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
  pagu_anggaran: number | null;
  paguMentah: unknown;
  nama_pptk?: string;
};

export type RencanaBaris = {
  baris: number;
  status: "baru" | "ubah" | "sama" | "galat";
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
  peringatan: string[];
  galat: string[];
};

export type DataAcuan = {
  programs: { id: string; kode_program: string }[];
  kegiatan: { id: string; kode_kegiatan: string; program_id: string }[];
  subs: { id: string; kode_sub_kegiatan: string; kegiatan_id: string }[];
  rekening: { id: string; sub_kegiatan_id: string; kode_rekening: string; sumber_dana: string }[];
  /** dpa di tahapan TUJUAN, per rekening_id */
  dpaTujuan: Map<string, { id: string; pagu_anggaran: number; pptk_id: string | null }>;
  /** pptk_id dari tahapan lain (dipakai mewarisi PPTK untuk baris baru), per rekening_id */
  pptkWarisan: Map<string, string>;
  pptk: { id: string; nama: string; sub_kegiatan_id: string | null }[];
  /** realisasi (status dicairkan) terakumulasi s/d tahapan tujuan, per rekening_id */
  realisasi: Map<string, number>;
};

// --------------------------------------------------------------- utilitas
const norm = (s: unknown) => String(s ?? "").trim();
const lc = (s: unknown) => norm(s).toLowerCase();

export function kelompokDariKode(kodeBelanja: string, teks?: string): string {
  if (/modal/i.test(teks || "")) return "Belanja Modal";
  if (/barang|jasa/i.test(teks || "")) return "Belanja Barang/Jasa";
  return kodeBelanja.startsWith("5.2.") ? "Belanja Modal" : "Belanja Barang/Jasa";
}

// Nama kolom yang diterima (huruf besar/kecil & spasi diabaikan).
const ALIAS: Record<string, keyof BarisFile> = {
  kode_program: "kode_program", nama_program: "nama_program",
  kode_kegiatan: "kode_kegiatan", nama_kegiatan: "nama_kegiatan",
  kode_sub_kegiatan: "kode_sub_kegiatan", kode_subkegiatan: "kode_sub_kegiatan", nama_sub_kegiatan: "nama_sub_kegiatan",
  kode_rekening: "kode_rekening", kode_rekening_lengkap: "kode_rekening", kode_rekening_belanja: "kode_rekening", rekening: "kode_rekening",
  jenis_belanja: "jenis_belanja", uraian_belanja: "jenis_belanja", uraian: "jenis_belanja", nama_rekening: "jenis_belanja",
  kelompok_belanja: "kelompok_belanja", jenis_rek: "kelompok_belanja",
  sumber_dana: "sumber_dana",
  pagu_anggaran: "pagu_anggaran", pagu: "pagu_anggaran", anggaran: "pagu_anggaran",
  nama_pptk: "nama_pptk", pptk: "nama_pptk",
};
const kunci = (h: unknown) => lc(h).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/** Baca workbook -> daftar baris. Mengembalikan galat umum (bukan per baris) bila format tidak cocok. */
export function bacaWorkbook(buf: Buffer): { baris: BarisFile[]; galat?: string } {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  } catch (e: any) {
    return { baris: [], galat: "File tidak bisa dibaca sebagai Excel (.xlsx): " + (e?.message || "") };
  }
  // Pilih sheet "Pagu" bila ada; selain itu sheet pertama yang punya judul kolom pagu & kode rekening.
  const namaSheet = wb.SheetNames.find((n) => lc(n) === "pagu") ??
    wb.SheetNames.find((n) => {
      const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[n], { header: 1, defval: "", blankrows: false });
      return rows.slice(0, 15).some((r) => r.map(kunci).includes("pagu_anggaran") || r.map(kunci).includes("pagu"));
    });
  if (!namaSheet) {
    return { baris: [], galat: "Sheet 'Pagu' tidak ditemukan. Gunakan template dari tombol \"Unduh template\"." };
  }
  const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[namaSheet], { header: 1, defval: "", blankrows: false });
  // Cari baris judul (toleran bila ada judul/keterangan di atasnya).
  let idxHeader = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const ks = rows[i].map(kunci).map((k: string) => ALIAS[k]);
    if (ks.includes("pagu_anggaran") && ks.includes("kode_rekening")) { idxHeader = i; break; }
  }
  if (idxHeader < 0) {
    return { baris: [], galat: "Judul kolom tidak ditemukan. Minimal harus ada kolom kode_rekening dan pagu_anggaran." };
  }
  const peta: (keyof BarisFile | null)[] = rows[idxHeader].map((h: unknown) => ALIAS[kunci(h)] ?? null);

  const out: BarisFile[] = [];
  for (let i = idxHeader + 1; i < rows.length; i++) {
    const r = rows[i];
    const obj: any = { baris: i + 1, pagu_anggaran: null, paguMentah: "" };
    let adaIsi = false;
    peta.forEach((k, c) => {
      if (!k) return;
      const v = r[c];
      if (norm(v) !== "") adaIsi = true;
      if (k === "pagu_anggaran") { obj.paguMentah = v; obj.pagu_anggaran = parseAngka(v); }
      else obj[k] = norm(v);
    });
    if (adaIsi) out.push(obj as BarisFile);
  }
  return { baris: out };
}

// ----------------------------------------------------------- rencana
export function susunRencana(baris: BarisFile[], ref: DataAcuan): RencanaBaris[] {
  const subByKode = new Map(ref.subs.map((s) => [s.kode_sub_kegiatan, s]));
  const kegByKode = new Map(ref.kegiatan.map((k) => [k.kode_kegiatan, k]));
  const progByKode = new Map(ref.programs.map((p) => [p.kode_program, p]));
  const rekByKunci = new Map(
    ref.rekening.map((r) => [`${r.sub_kegiatan_id}|${r.kode_rekening}|${lc(r.sumber_dana)}`, r])
  );
  const sudahDiFile = new Map<string, number>(); // kunci -> nomor baris pertama
  const out: RencanaBaris[] = [];

  for (const b of baris) {
    const galat: string[] = [];
    const peringatan: string[] = [];

    // --- kode rekening lengkap & kode sub kegiatan
    let kodeRek = norm(b.kode_rekening);
    let kodeSub = norm(b.kode_sub_kegiatan);
    if (!kodeRek) galat.push("kode_rekening kosong");
    if (POLA_KODE_BELANJA.test(kodeRek)) {
      if (!kodeSub) galat.push("kode_sub_kegiatan wajib diisi bila kode_rekening hanya kode belanja (6 segmen)");
      else kodeRek = `${kodeSub}.${kodeRek}`;
    } else if (kodeRek) {
      const belanja = kodeRek.slice(-19);
      const awalan = kodeRek.slice(0, -20);
      if (kodeRek.length <= 20 || kodeRek.charAt(kodeRek.length - 20) !== "." || !POLA_KODE_BELANJA.test(belanja)) {
        galat.push(`kode_rekening '${kodeRek}' tidak sesuai format (kode sub kegiatan + 5.1.02.01.001.00024)`);
      } else if (!kodeSub) {
        kodeSub = awalan;
      } else if (kodeSub !== awalan) {
        galat.push(`kode_rekening tidak diawali kode sub kegiatan ${kodeSub}`);
      }
    }

    // --- sumber dana & pagu
    const sumber = norm(b.sumber_dana);
    if (!sumber) galat.push("sumber_dana kosong");
    let pagu = b.pagu_anggaran;
    if (pagu === null) galat.push(`pagu_anggaran '${norm(b.paguMentah)}' bukan angka`);
    else if (pagu < 0) galat.push("pagu_anggaran tidak boleh negatif");
    else pagu = round2(pagu);

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
        galat.push(`Sub kegiatan ${kodeSub} belum ada. Isi kolom nama_sub_kegiatan agar dibuat otomatis (atau tambahkan lebih dulu di menu Rekening).`);
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

    // --- rekening master
    const uraian = norm(b.jenis_belanja);
    const rek = sub ? rekByKunci.get(`${sub.id}|${kodeRek}|${lc(sumber)}`) : undefined;
    if (!rek && !galat.length && !uraian) {
      galat.push("Rekening baru: kolom jenis_belanja (uraian belanja) wajib diisi.");
    }

    // --- duplikat dalam file
    const kunciFile = `${kodeSub}|${kodeRek}|${lc(sumber)}`;
    if (kodeRek && sumber) {
      const pertama = sudahDiFile.get(kunciFile);
      if (pertama) galat.push(`Duplikat dengan baris ${pertama} (rekening + sumber dana yang sama)`);
      else sudahDiFile.set(kunciFile, b.baris);
    }

    // --- DPA tujuan, realisasi, PPTK
    const dpa = rek ? ref.dpaTujuan.get(rek.id) : undefined;
    const realisasi = rek ? round2(ref.realisasi.get(rek.id) ?? 0) : 0;
    let pptkId: string | null = dpa?.pptk_id ?? null;
    const namaPptk = norm(b.nama_pptk);
    if (namaPptk) {
      const kandidat = ref.pptk.filter((p) => lc(p.nama) === lc(namaPptk));
      const cocok = kandidat.find((p) => sub && p.sub_kegiatan_id === sub.id) ?? kandidat[0];
      if (cocok) pptkId = cocok.id;
      else peringatan.push(`PPTK '${namaPptk}' belum terdaftar di menu Manajemen Akun -- PPTK tidak diubah.`);
    } else if (!pptkId && rek) {
      pptkId = ref.pptkWarisan.get(rek.id) ?? null; // baris baru mewarisi PPTK tahapan sebelumnya
    }

    const paguBaru = pagu ?? 0;
    const paguLama = dpa ? Number(dpa.pagu_anggaran) : null;
    if (!galat.length && paguBaru < realisasi) {
      peringatan.push(`Pagu lebih kecil dari realisasi yang sudah tercatat (Rp ${realisasi.toLocaleString("id-ID")}) -- sisa anggaran akan negatif.`);
    }
    if (!galat.length && !rek) peringatan.push("Rekening baru akan dibuat.");
    if (!galat.length && buatSub) peringatan.push("Sub kegiatan baru akan dibuat" + (buatKeg ? " (beserta kegiatan" + (buatProg ? " & program" : "") + ")" : "") + ".");

    let status: RencanaBaris["status"];
    if (galat.length) status = "galat";
    else if (paguLama === null) status = "baru";
    else if (Math.abs(paguLama - paguBaru) < 0.005 && (!namaPptk || pptkId === dpa?.pptk_id)) status = "sama";
    else status = "ubah";

    out.push({
      baris: b.baris,
      status,
      kode_sub_kegiatan: kodeSub,
      kode_rekening: kodeRek,
      sumber_dana: sumber,
      jenis_belanja: uraian,
      kelompok_belanja: kelompokDariKode(kodeRek.slice(-19), b.kelompok_belanja),
      nama_sub_kegiatan: norm(b.nama_sub_kegiatan) || undefined,
      nama_kegiatan: norm(b.nama_kegiatan) || undefined,
      kode_kegiatan: kodeKeg || undefined,
      nama_program: norm(b.nama_program) || undefined,
      kode_program: kodeProg || undefined,
      pagu_lama: paguLama,
      pagu_baru: paguBaru,
      selisih: round2(paguBaru - (paguLama ?? 0)),
      realisasi,
      rekening_id: rek?.id ?? null,
      dpa_id: dpa?.id ?? null,
      sub_kegiatan_id: sub?.id ?? null,
      pptk_id: pptkId,
      buat_sub_kegiatan: buatSub,
      buat_kegiatan: buatKeg,
      buat_program: buatProg,
      peringatan,
      galat,
    });
  }
  return out;
}
