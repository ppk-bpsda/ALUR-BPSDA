import { isUuid } from "@/lib/auth";

export type RincianInput = {
  nama_item: string;
  qty: number;
  satuan: string;
  harga_satuan: number;
  kena_ppn_tambahan: boolean;
};

export type PotonganInput = {
  jenis_pajak: string;
  persentase: number | null;
  nominal: number;
  tipe: "potongan" | "tambahan";
};

export type PengajuanInput = {
  dpa_id: string;
  tanggal: string;
  uraian_kegiatan: string;
  penyedia_id: string | null;
  nama_penerima: string | null;
  cetak_ttd_penerima: boolean;
  metode_pembayaran: "LS" | "GU";
  nomor_nota_dinas: string | null;
  nomor_bukti: string | null;
  rincian: RincianInput[];
  potongan: PotonganInput[];
  jumlah_pengajuan: number;
};

/** Pembulatan 2 desimal yang tahan galat floating point (mis. 1.005, 0.1*3). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function isValidISODate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function str(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s.length > max) return null;
  return s;
}

function num(v: unknown): number | null {
  if (typeof v === "string" && v.trim() === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

type Result = { ok: true; data: PengajuanInput } | { ok: false; error: string };

/**
 * Validasi + normalisasi body POST/PUT pengajuan di SERVER. Sebelumnya server
 * mempercayai penuh angka dari browser (qty negatif, NaN, teks, field asing
 * seperti `_totalNego` yang ikut ter-insert ke database, dst).
 *
 * `jumlah_pengajuan` DIHITUNG ULANG di sini dari rincian (+ potongan bertipe
 * "tambahan"), tiap baris dibulatkan 2 desimal sama seperti kolom generated
 * `subtotal` di database, supaya total di header = jumlah subtotal rincian.
 */
export function parsePengajuanBody(body: unknown): Result {
  if (!body || typeof body !== "object") return { ok: false, error: "Body request tidak valid." };
  const b = body as Record<string, any>;

  if (!isUuid(b.dpa_id)) return { ok: false, error: "DPA / rekening tidak valid." };
  if (!isValidISODate(b.tanggal)) return { ok: false, error: "Tanggal tidak valid (format YYYY-MM-DD)." };

  const uraian = str(b.uraian_kegiatan, 2000);
  if (!uraian) return { ok: false, error: "Uraian kegiatan wajib diisi (maksimal 2000 karakter)." };

  let penyedia_id: string | null = null;
  if (b.penyedia_id) {
    if (!isUuid(b.penyedia_id)) return { ok: false, error: "Penyedia tidak valid." };
    penyedia_id = b.penyedia_id;
  }

  const nama_penerima = b.nama_penerima ? str(b.nama_penerima, 200) : null;
  if (b.nama_penerima && nama_penerima === null) return { ok: false, error: "Nama penerima terlalu panjang." };

  const metode = String(b.metode_pembayaran || "GU").toUpperCase();
  if (metode !== "LS" && metode !== "GU") return { ok: false, error: "Metode pembayaran harus LS atau GU." };

  const nomor_nota_dinas = b.nomor_nota_dinas ? str(b.nomor_nota_dinas, 150) : null;
  const nomor_bukti = b.nomor_bukti ? str(b.nomor_bukti, 150) : null;
  if ((b.nomor_nota_dinas && nomor_nota_dinas === null) || (b.nomor_bukti && nomor_bukti === null)) {
    return { ok: false, error: "Nomor Nota Dinas / Nomor Bukti terlalu panjang." };
  }

  if (!Array.isArray(b.rincian) || b.rincian.length < 1) {
    return { ok: false, error: "Minimal satu rincian belanja harus diisi." };
  }
  if (b.rincian.length > 200) return { ok: false, error: "Rincian belanja maksimal 200 baris." };

  const rincian: RincianInput[] = [];
  for (let i = 0; i < b.rincian.length; i++) {
    const r = b.rincian[i] ?? {};
    const nama_item = str(r.nama_item, 500);
    const qty = num(r.qty);
    const harga = num(r.harga_satuan);
    const satuan = str(r.satuan ?? "", 50);
    if (!nama_item) return { ok: false, error: `Rincian #${i + 1}: nama item wajib diisi.` };
    if (qty === null || qty <= 0 || qty > 1e8) return { ok: false, error: `Rincian #${i + 1}: qty harus lebih dari 0.` };
    if (harga === null || harga < 0 || harga > 1e13) return { ok: false, error: `Rincian #${i + 1}: harga satuan tidak valid.` };
    if (satuan === null) return { ok: false, error: `Rincian #${i + 1}: satuan terlalu panjang.` };
    rincian.push({ nama_item, qty, satuan, harga_satuan: harga, kena_ppn_tambahan: r.kena_ppn_tambahan === true });
  }

  const potonganRaw = Array.isArray(b.potongan) ? b.potongan : [];
  if (potonganRaw.length > 50) return { ok: false, error: "Potongan pajak maksimal 50 baris." };
  const potongan: PotonganInput[] = [];
  for (let i = 0; i < potonganRaw.length; i++) {
    const p = potonganRaw[i] ?? {};
    const jenis = str(p.jenis_pajak, 120);
    const nominal = num(p.nominal);
    const persen = p.persentase === null || p.persentase === undefined || p.persentase === "" ? null : num(p.persentase);
    const tipe = p.tipe === "tambahan" ? "tambahan" : "potongan";
    if (!jenis) return { ok: false, error: `Potongan #${i + 1}: jenis pajak wajib diisi.` };
    if (nominal === null || nominal < 0 || nominal > 1e13) return { ok: false, error: `Potongan #${i + 1}: nominal tidak valid.` };
    if (persen !== null && (persen < 0 || persen > 100)) return { ok: false, error: `Potongan #${i + 1}: persentase harus 0-100.` };
    potongan.push({ jenis_pajak: jenis, persentase: persen, nominal: round2(nominal), tipe });
  }

  // jumlah_pengajuan = Total Tagihan yang dibebankan ke anggaran: jumlah
  // subtotal rincian + potongan bertipe 'tambahan' (mis. PPN atas harga
  // netto). Potongan bertipe 'potongan' tidak menambah realisasi anggaran.
  const totalRincian = rincian.reduce((s, r) => s + round2(r.qty * r.harga_satuan), 0);
  const totalTambahan = potongan.filter((p) => p.tipe === "tambahan").reduce((s, p) => s + p.nominal, 0);
  const jumlah_pengajuan = round2(totalRincian + totalTambahan);
  if (jumlah_pengajuan <= 0) return { ok: false, error: "Jumlah pengajuan harus lebih dari Rp 0." };

  return {
    ok: true,
    data: {
      dpa_id: b.dpa_id,
      tanggal: b.tanggal,
      uraian_kegiatan: uraian,
      penyedia_id,
      nama_penerima: nama_penerima || null,
      cetak_ttd_penerima: b.cetak_ttd_penerima !== false,
      metode_pembayaran: metode,
      nomor_nota_dinas: nomor_nota_dinas || null,
      nomor_bukti: nomor_bukti || null,
      rincian,
      potongan,
      jumlah_pengajuan,
    },
  };
}
