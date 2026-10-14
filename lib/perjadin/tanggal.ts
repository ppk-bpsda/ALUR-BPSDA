export const BULAN_ID = [
  "januari", "februari", "maret", "april", "mei", "juni",
  "juli", "agustus", "september", "oktober", "november", "desember",
];
const BULAN_ALIAS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, jun: 6, jul: 7, agu: 8, agt: 8, ags: 8, sep: 9, sept: 9, okt: 10, nov: 11, nop: 11, des: 12,
};

export function bulanKe(nama: string): number | null {
  const n = nama.toLowerCase().replace(/\./g, "");
  const i = BULAN_ID.indexOf(n);
  if (i >= 0) return i + 1;
  return BULAN_ALIAS[n] ?? null;
}

export const POLA_BULAN = "(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|agt|ags|sept|sep|okt|nop|nov|des)\\.?";

export function iso(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Jumlah hari inklusif (berangkat s.d. kembali). */
export function hitungHari(mulai: string, selesai: string): number {
  const a = Date.parse(mulai + "T00:00:00Z");
  const b = Date.parse(selesai + "T00:00:00Z");
  if (!isFinite(a) || !isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}
