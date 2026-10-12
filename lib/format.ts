const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Tanggal dari database berformat "YYYY-MM-DD" (kolom DATE). `new Date(str)`
// menafsirkannya sebagai tengah malam UTC lalu getDate() memakai zona waktu
// LOKAL -- di zona waktu negatif (atau bila kode dijalankan di klien dengan
// zona tak terduga) tanggal di dokumen resmi bisa mundur sehari. Di sini
// komponen tanggal dibaca langsung dari string, tanpa konversi zona waktu.
function parseTanggal(dateStr: string): { y: number; m: number; d: number; dow: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr ?? ""));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, m: mo, d, dow: dt.getUTCDay() };
}

export function formatTanggalSurat(dateStr: string): string {
  const t = parseTanggal(dateStr);
  if (!t) return "-";
  return `${t.d} ${BULAN[t.m - 1]} ${t.y}`;
}

export function formatHariTanggal(dateStr: string): string {
  const t = parseTanggal(dateStr);
  if (!t) return "-";
  return `${HARI[t.dow]}, ${t.d} ${BULAN[t.m - 1]} ${t.y}`;
}

// Kode Rekening yang tersimpan di database SELALU kode rekening LENGKAP
// (kode sub kegiatan + kode rekening belanja, mis.
// "4.01.01.2.02.0002.5.1.02.02.001.00080"). Kalau ada input/tampilan yang
// butuh "Kode Rekening Belanja" saja (tanpa prefix sub kegiatan), turunkan
// dari 19 karakter TERAKHIR kode lengkap -- jangan simpan sebagai baris/kolom
// terpisah, supaya tidak terjadi lagi duplikasi seperti yang sempat terjadi
// di tahapan MURNI (kode lengkap & kode belanja saja tercatat sebagai dua
// baris rekening_belanja yang berbeda untuk akun yang sama).
export function kodeRekeningBelanja(kodeRekeningLengkap: string | null | undefined): string {
  if (!kodeRekeningLengkap) return "-";
  return kodeRekeningLengkap.length > 19 ? kodeRekeningLengkap.slice(-19) : kodeRekeningLengkap;
}
