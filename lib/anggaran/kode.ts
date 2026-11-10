/**
 * Aturan kode rekening -- SATU sumber kebenaran untuk impor Excel, form manual,
 * dan pesan galat. (Database punya penjaga yang sama: trigger jaga_rekening_belanja.)
 *
 * Kode rekening LENGKAP = kode sub kegiatan + "." + kode belanja (6 segmen)
 *   4.01.01.2.07.0001 . 5.1.02.01.001.00024
 */

// Kode rekening belanja saja (6 segmen), mis. 5.1.02.01.001.00024
export const POLA_KODE_BELANJA = /^\d\.\d\.\d{2}\.\d{2}\.\d{3}\.\d{5}$/;

/** Hapus spasi, NBSP, karakter lebar-nol, dan titik di ujung hasil salin dari Excel/PDF/WhatsApp. */
export function bersihkanKode(v: unknown): string {
  return String(v ?? "")
    .replace(/[\s\u00a0\u200b-\u200d\ufeff]+/g, "")
    .replace(/,/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

/** Rapikan teks bebas (uraian, sumber dana): spasi ganda/ujung/NBSP -> satu spasi. */
export function rapikanTeks(v: unknown): string {
  return String(v ?? "").replace(/[\s\u00a0\u200b-\u200d\ufeff]+/g, " ").trim();
}

export type HasilKode = {
  ok: boolean;
  /** kode lengkap (bila ok) */
  kode: string;
  /** kode sub kegiatan hasil bacaan (bila ok) */
  kodeSub: string;
  /** kode belanja 6 segmen (bila ok) */
  kodeBelanja: string;
  galat?: string;
};

/**
 * Lengkapi & periksa kode rekening.
 *  - kodeInput 6 segmen  -> wajib ada kodeSub (diambil dari kolom sub kegiatan / pilihan sub kegiatan)
 *  - kodeInput lengkap   -> kodeSub boleh kosong (diambil dari awalan); bila diisi harus sama dengan awalan
 */
export function periksaKode(kodeInput: unknown, kodeSubInput?: unknown): HasilKode {
  const masuk = bersihkanKode(kodeInput);
  const sub = bersihkanKode(kodeSubInput);
  const gagal = (galat: string): HasilKode => ({ ok: false, kode: masuk, kodeSub: sub, kodeBelanja: "", galat });

  if (!masuk) return gagal("kode_rekening kosong");

  if (POLA_KODE_BELANJA.test(masuk)) {
    if (!sub) return gagal("kode_sub_kegiatan wajib diisi bila kode_rekening hanya kode belanja (6 segmen)");
    return { ok: true, kode: `${sub}.${masuk}`, kodeSub: sub, kodeBelanja: masuk };
  }

  const belanja = masuk.slice(-19);
  const awalan = masuk.slice(0, -20);
  if (masuk.length <= 20 || masuk.charAt(masuk.length - 20) !== "." || !POLA_KODE_BELANJA.test(belanja)) {
    return gagal(
      `kode_rekening '${masuk}' tidak sesuai format. Harus kode sub kegiatan + kode belanja, ` +
        `mis. 4.01.01.2.07.0001.5.1.02.01.001.00024 (bagian belanja harus 6 segmen: X.X.XX.XX.XXX.XXXXX)`
    );
  }
  if (sub && sub !== awalan) return gagal(`kode_rekening diawali ${awalan}, tetapi kode sub kegiatan yang diisi ${sub}`);
  return { ok: true, kode: masuk, kodeSub: awalan, kodeBelanja: belanja };
}

/** Jarak edit (Levenshtein) kecil -- cukup untuk membandingkan kode ber-panjang ~19. */
function jarak(a: string, b: string, batas: number): number {
  if (Math.abs(a.length - b.length) > batas) return batas + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let minBaris = cur[0];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < minBaris) minBaris = cur[j];
    }
    if (minBaris > batas) return batas + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Kode katalog yang paling mirip (maks 2 karakter beda) -- untuk saran "maksud Anda ...?". */
export function saranKodeBelanja(kodeBelanja: string, katalog: Iterable<string>, maks = 3): string[] {
  const hasil: { kode: string; d: number }[] = [];
  for (const k of katalog) {
    const d = jarak(kodeBelanja, k, 2);
    if (d <= 2) hasil.push({ kode: k, d });
  }
  return hasil.sort((x, y) => x.d - y.d || x.kode.localeCompare(y.kode)).slice(0, maks).map((x) => x.kode);
}
