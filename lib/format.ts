const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function formatTanggalSurat(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatHariTanggal(dateStr: string): string {
  const d = new Date(dateStr);
  return `${HARI[d.getDay()]}, ${formatTanggalSurat(dateStr)}`;
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
