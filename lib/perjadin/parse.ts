import { bulanKe, iso, POLA_BULAN } from "./tanggal";
import { tebakTujuan } from "./wilayah";

export type PegawaiRef = { id: string; nama: string; nip: string };

export type HasilParse = {
  nomor_surat_tugas?: string;
  tanggal_surat_tugas?: string;
  maksud?: string;
  tujuan_kota?: string;
  tujuan_provinsi?: string;
  tanggal_berangkat?: string;
  tanggal_kembali?: string;
  peserta_ids: string[];
  catatan: string[];
};

const RE_TGL = new RegExp(`(\\d{1,2})\\s+(${POLA_BULAN})\\s+(\\d{4})`, "gi");
const SEP = "(?:s\\/d|s\\.d\\.?|s\\.d|sd|sampai dengan|sampai|hingga|-|–|—)";
const RE_RENTANG = new RegExp(
  `(\\d{1,2})\\s*(?:(${POLA_BULAN})\\s*(\\d{4})?)?\\s*${SEP}\\s*(\\d{1,2})\\s*(${POLA_BULAN})\\s*(\\d{4})`,
  "gi"
);

function tglDariMatch(d: string, b: string, y: string): string | null {
  const m = bulanKe(b);
  return m ? iso(Number(y), m, Number(d)) : null;
}

function semuaTanggal(teks: string): { iso: string; idx: number }[] {
  const out: { iso: string; idx: number }[] = [];
  for (const m of teks.matchAll(RE_TGL)) {
    const v = tglDariMatch(m[1], m[2], m[3]);
    if (v) out.push({ iso: v, idx: m.index ?? 0 });
  }
  return out;
}

function cariRentang(teks: string): { mulai: string; selesai: string } | null {
  for (const m of teks.matchAll(RE_RENTANG)) {
    const bln2 = m[5], thn2 = m[6];
    const selesai = tglDariMatch(m[4], bln2, thn2);
    const mulai = tglDariMatch(m[1], m[2] || bln2, m[3] || thn2);
    if (mulai && selesai && mulai <= selesai) return { mulai, selesai };
  }
  return null;
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/** Inti nama tanpa gelar: "Dra. Emilyati, M.Si" -> "emilyati" ; "Dr. Ir. Budi Santoso, MT" -> "budi santoso" */
function inti(nama: string) {
  let n = nama.split(",")[0];
  n = n.replace(/\b(dr|dra|drs|ir|prof|h|hj|hi)\b\.?/gi, " ");
  return norm(n);
}

function cariPeserta(teks: string, pegawai: PegawaiRef[]): string[] {
  const teksNorm = norm(teks);
  const barisDigit = teks.split("\n").map((l) => l.replace(/\D/g, ""));
  const hits: { id: string; idx: number }[] = [];
  for (const p of pegawai) {
    let idx = -1;
    const nip = (p.nip || "").replace(/\D/g, "");
    if (nip.length >= 15) {
      const li = barisDigit.findIndex((d) => d.includes(nip));
      if (li >= 0) idx = teks.split("\n").slice(0, li).join("\n").length;
    }
    if (idx < 0) {
      const full = norm(p.nama);
      const core = inti(p.nama);
      const tokens = core.split(" ").filter(Boolean);
      const kuat = tokens.length >= 2 || core.length >= 7;
      for (const key of [full, core]) {
        if (!key || (key === core && !kuat)) continue;
        const re = new RegExp(`(?<![a-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`);
        const m = re.exec(teksNorm);
        if (m) { idx = m.index; break; }
      }
    }
    if (idx >= 0) hits.push({ id: p.id, idx });
  }
  return hits.sort((a, b) => a.idx - b.idx).map((h) => h.id);
}

function bersihkan(s: string, maks = 500) {
  return s
    .replace(/^\s*(?:\d+[.)]|[a-z][.)]|[-•])\s*/i, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maks);
}

function cariMaksud(teksST: string, teksLaporan: string): string | undefined {
  const pola: RegExp[] = [
    /(?:^|\n)\s*Untuk\s*[:：]\s*([\s\S]{10,700}?)(?=\n\s*\n|\n\s*(?:Ditetapkan|Dikeluarkan|Batu\s*,|Demikian|Kepala|Sekretaris|Asisten)|$)/i,
    /(?:^|\n)\s*(?:Perihal|Hal)\s*[:：]\s*([^\n]{10,300})/i,
    /(?:dalam rangka|untuk menghadiri|untuk mengikuti|untuk melaksanakan|guna)\s+([^\n]{10,400})/i,
  ];
  for (const re of pola) {
    const m = teksST.match(re);
    if (m?.[1]) return bersihkan(m[1]);
  }
  const lap = teksLaporan.match(
    /Maksud(?:\s+dan\s+Tujuan)?\s*[:：]?\s*\n?([\s\S]{10,500}?)(?=\n\s*\n|\n\s*[A-Z][.)]\s|$)/i
  );
  return lap?.[1] ? bersihkan(lap[1]) : undefined;
}

export function parseSuratTugas(
  teksST: string,
  teksLaporan: string,
  pegawai: PegawaiRef[],
  daftarProvinsi: string[]
): HasilParse {
  const out: HasilParse = { peserta_ids: [], catatan: [] };
  const gabung = `${teksST}\n${teksLaporan}`;

  // Nomor surat
  const nomor = teksST.match(/Nomor\s*(?:Surat)?\s*[:.]?\s*([0-9A-Za-z.\-]+(?:\/[0-9A-Za-z.\-]+)+)/i);
  if (nomor) out.nomor_surat_tugas = nomor[1];
  else out.catatan.push("Nomor Surat Tugas tidak terbaca — isi manual.");

  // Tanggal surat: tanggal yang mengikuti "Batu," / "Ditetapkan di Batu" / "Pada tanggal"
  const tglSurat = teksST.match(new RegExp(`(?:Batu\\s*,|pada\\s+tanggal\\s*[:.]?)\\s*(\\d{1,2})\\s+(${POLA_BULAN})\\s+(\\d{4})`, "i"));
  if (tglSurat) out.tanggal_surat_tugas = tglDariMatch(tglSurat[1], tglSurat[2], tglSurat[3]) ?? undefined;

  // Tanggal pelaksanaan: Surat Tugas diutamakan, laporan sebagai cadangan
  const rST = cariRentang(teksST);
  const rLap = cariRentang(teksLaporan);
  const r = rST ?? rLap;
  if (r) {
    out.tanggal_berangkat = r.mulai;
    out.tanggal_kembali = r.selesai;
    if (rST && rLap && (rST.mulai !== rLap.mulai || rST.selesai !== rLap.selesai)) {
      out.catatan.push(
        `Tanggal pada Laporan (${rLap.mulai} s.d. ${rLap.selesai}) berbeda dengan Surat Tugas (${rST.mulai} s.d. ${rST.selesai}). Yang dipakai: Surat Tugas — periksa kembali.`
      );
    }
  } else {
    const kandidat = semuaTanggal(teksST).filter((t) => t.iso !== out.tanggal_surat_tugas);
    const fallback = kandidat[0] ?? semuaTanggal(teksLaporan)[0];
    if (fallback) {
      out.tanggal_berangkat = fallback.iso;
      out.tanggal_kembali = fallback.iso;
      out.catatan.push("Hanya satu tanggal pelaksanaan yang terbaca (dianggap 1 hari) — periksa kembali.");
    } else {
      out.catatan.push("Tanggal pelaksanaan tidak terbaca — isi manual.");
    }
  }

  // Maksud / uraian
  out.maksud = cariMaksud(teksST, teksLaporan);
  if (!out.maksud) out.catatan.push("Maksud perjalanan dinas tidak terbaca — isi manual.");

  // Tujuan: Surat Tugas diutamakan (baris berkata kunci -> uraian "Untuk"), laporan sesudahnya
  const barisKunci = (t: string) =>
    t.split("\n").filter((l) => /tujuan|tempat|lokasi|ke\s+(?:kota|kab|provinsi)|bertempat/i.test(l)).join("\n");
  const kandidatTeks = [barisKunci(teksST), out.maksud ?? "", barisKunci(teksLaporan), teksST, teksLaporan];
  let teb: { provinsi?: string; kota?: string } = {};
  for (const t of kandidatTeks) {
    if (!t) continue;
    const r = tebakTujuan(t, daftarProvinsi);
    if (r.provinsi) { teb = r; break; }
  }
  out.tujuan_provinsi = teb.provinsi;
  out.tujuan_kota = teb.kota;
  if (!out.tujuan_provinsi) out.catatan.push("Tujuan/provinsi tidak terbaca — pilih manual (menentukan tarif SBU).");

  // Peserta dari Data Pegawai
  out.peserta_ids = cariPeserta(gabung, pegawai);
  if (out.peserta_ids.length === 0) out.catatan.push("Tidak ada nama/NIP pegawai yang cocok dengan Data Pegawai — pilih peserta manual.");

  return out;
}
