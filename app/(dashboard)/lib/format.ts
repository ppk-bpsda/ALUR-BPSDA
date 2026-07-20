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
