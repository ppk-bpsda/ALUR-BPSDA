// Konversi angka menjadi teks terbilang Bahasa Indonesia.
// Dipakai supaya "jumlah_uang_terbilang" pada Kwitansi & SPP SELALU
// mengikuti nominal "jumlah_uang" secara otomatis -- Admin tidak perlu
// mengetik terbilang manual.

const SATUAN = [
  "", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan",
  "sepuluh", "sebelas",
];

function terbilangRatusan(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} belas`;
  if (n < 100) {
    const sisa = n % 10;
    return `${SATUAN[Math.floor(n / 10)]} puluh${sisa ? " " + terbilangRatusan(sisa) : ""}`;
  }
  if (n < 200) return `seratus${n - 100 ? " " + terbilangRatusan(n - 100) : ""}`;
  if (n < 1000) {
    const sisa = n % 100;
    return `${SATUAN[Math.floor(n / 100)]} ratus${sisa ? " " + terbilangRatusan(sisa) : ""}`;
  }
  return "";
}

export function terbilang(num: number): string {
  if (num === 0) return "nol rupiah";
  if (num < 0) return "minus " + terbilang(-num);

  const n = Math.floor(num);
  const bagian: { nilai: number; label: string }[] = [
    { nilai: 1_000_000_000_000, label: "triliun" },
    { nilai: 1_000_000_000, label: "miliar" },
    { nilai: 1_000_000, label: "juta" },
    { nilai: 1_000, label: "ribu" },
  ];

  let sisa = n;
  const hasil: string[] = [];

  for (const b of bagian) {
    const jumlah = Math.floor(sisa / b.nilai);
    if (jumlah > 0) {
      if (b.label === "ribu" && jumlah === 1) {
        hasil.push("seribu");
      } else {
        hasil.push(`${terbilangRatusan(jumlah)} ${b.label}`);
      }
      sisa -= jumlah * b.nilai;
    }
  }
  if (sisa > 0) hasil.push(terbilangRatusan(sisa));

  const teks = hasil.join(" ").replace(/\s+/g, " ").trim();
  const kapital = teks.charAt(0).toUpperCase() + teks.slice(1);
  return `${kapital} Rupiah`;
}

export function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID").format(Math.round(n));
}
