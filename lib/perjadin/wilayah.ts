// Pemetaan alias provinsi & kota besar -> nama provinsi persis seperti di
// tabel SBU (Data_SBU - Uang Harian). Dipakai untuk menebak tujuan dari teks
// Surat Tugas; hasilnya SELALU bisa dikoreksi manual di formulir.
export const ALIAS_PROVINSI: Record<string, string> = {
  "daerah istimewa yogyakarta": "DI Yogyakarta",
  "d.i. yogyakarta": "DI Yogyakarta",
  "di yogyakarta": "DI Yogyakarta",
  "yogyakarta": "DI Yogyakarta",
  "jogja": "DI Yogyakarta",
  "daerah khusus ibukota jakarta": "DKI Jakarta",
  "dki jakarta": "DKI Jakarta",
  "jakarta": "DKI Jakarta",
  "jatim": "Jawa Timur", "jabar": "Jawa Barat", "jateng": "Jawa Tengah",
  "kepri": "Kepulauan Riau", "ntb": "Nusa Tenggara Barat", "ntt": "Nusa Tenggara Timur",
  "babel": "Bangka Belitung", "kepulauan bangka belitung": "Bangka Belitung",
  "sumut": "Sumatera Utara", "sumbar": "Sumatera Barat", "sumsel": "Sumatera Selatan",
  "sulsel": "Sulawesi Selatan", "sulteng": "Sulawesi Tengah", "sultra": "Sulawesi Tenggara", "sulut": "Sulawesi Utara",
  "kalbar": "Kalimantan Barat", "kalsel": "Kalimantan Selatan", "kalteng": "Kalimantan Tengah", "kaltim": "Kalimantan Timur", "kaltara": "Kalimantan Utara",
};

const KOTA: Record<string, string[]> = {
  "Jawa Timur": ["surabaya", "malang", "sidoarjo", "gresik", "kediri", "madiun", "jember", "banyuwangi", "mojokerto", "pasuruan", "probolinggo", "blitar", "tulungagung", "bondowoso", "lumajang", "bojonegoro", "tuban", "lamongan", "jombang", "nganjuk", "ngawi", "ponorogo", "pacitan", "trenggalek", "magetan", "situbondo", "sumenep", "pamekasan", "sampang", "bangkalan", "batu"],
  "Jawa Barat": ["bandung", "bogor", "bekasi", "depok", "cirebon", "sukabumi", "tasikmalaya", "garut", "karawang", "cimahi"],
  "Jawa Tengah": ["semarang", "surakarta", "solo", "magelang", "salatiga", "pekalongan", "tegal", "purwokerto", "kudus", "klaten", "sragen"],
  "Banten": ["tangerang", "serang", "cilegon", "tangerang selatan"],
  "DI Yogyakarta": ["sleman", "bantul", "gunungkidul", "kulon progo"],
  "Bali": ["denpasar", "badung", "gianyar", "ubud", "kuta", "nusa dua", "singaraja"],
  "Nusa Tenggara Barat": ["mataram", "lombok", "mandalika", "sumbawa", "bima"],
  "Nusa Tenggara Timur": ["kupang", "labuan bajo", "maumere", "ende"],
  "Sumatera Utara": ["medan", "binjai", "pematangsiantar", "sibolga"],
  "Sumatera Barat": ["padang", "bukittinggi", "payakumbuh"],
  "Sumatera Selatan": ["palembang", "prabumulih", "lubuklinggau"],
  "Riau": ["pekanbaru", "dumai"],
  "Kepulauan Riau": ["batam", "tanjungpinang", "bintan"],
  "Jambi": [],
  "Lampung": ["bandar lampung", "metro"],
  "Bengkulu": [],
  "Aceh": ["banda aceh", "lhokseumawe", "sabang"],
  "Bangka Belitung": ["pangkalpinang", "pangkal pinang"],
  "Kalimantan Timur": ["balikpapan", "samarinda", "bontang", "ikn", "nusantara"],
  "Kalimantan Selatan": ["banjarmasin", "banjarbaru"],
  "Kalimantan Barat": ["pontianak", "singkawang"],
  "Kalimantan Tengah": ["palangkaraya", "palangka raya"],
  "Kalimantan Utara": ["tarakan", "tanjung selor"],
  "Sulawesi Selatan": ["makassar", "parepare", "palopo"],
  "Sulawesi Utara": ["manado", "bitung"],
  "Sulawesi Tengah": ["palu"],
  "Sulawesi Tenggara": ["kendari", "baubau"],
  "Sulawesi Barat": ["mamuju"],
  "Gorontalo": [],
  "Maluku": ["ambon"],
  "Maluku Utara": ["ternate", "tidore"],
  "Papua": ["jayapura", "merauke", "timika"],
  "Papua Barat": ["manokwari", "sorong"],
};

export type TebakanTujuan = { provinsi?: string; kota?: string };

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Cari provinsi/kota dalam potongan teks. `daftarProvinsi` = kolom Tujuan di tabel SBU. */
export function tebakTujuan(teks: string, daftarProvinsi: string[]): TebakanTujuan {
  const t = teks.toLowerCase();
  const kata = (k: string) => new RegExp(`(?<![a-z])${esc(k)}(?![a-z])`, "i");

  // 1) provinsi disebut eksplisit (nama terpanjang dulu agar "Papua Barat" menang atas "Papua")
  const kandidat = [...daftarProvinsi.filter((p) => p.toLowerCase() !== "kota batu")]
    .sort((a, b) => b.length - a.length);
  let provinsi: string | undefined;
  for (const p of kandidat) if (kata(p.toLowerCase()).test(t)) { provinsi = p; break; }
  if (!provinsi) {
    for (const [alias, prov] of Object.entries(ALIAS_PROVINSI).sort((a, b) => b[0].length - a[0].length)) {
      if (kata(alias).test(t)) { provinsi = prov; break; }
    }
  }
  // 2) kota
  let kota: string | undefined;
  for (const [prov, list] of Object.entries(KOTA)) {
    for (const k of list.sort((a, b) => b.length - a.length)) {
      if (k === "batu") continue; // "Kota Batu" muncul di kop surat -- jangan ditebak
      if (kata(k).test(t)) {
        kota = k.replace(/\b\w/g, (c) => c.toUpperCase());
        if (!provinsi) provinsi = prov;
        break;
      }
    }
    if (kota) break;
  }
  return { provinsi, kota };
}
