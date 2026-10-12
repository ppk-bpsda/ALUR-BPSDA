import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isValidISODate, round2 } from "@/lib/pengajuanValidation";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_PENGAJUAN = 2000;
const MAX_RINCIAN = 20000;

// PostgREST membatasi respons 1000 baris per request. Query "select semua"
// tanpa paginasi diam-diam terpotong di 1000 baris -> kode rekening / DPA
// yang ada di baris ke-1001 dst dianggap "tidak ditemukan". Helper ini
// mengambil semua halaman.
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

type PengajuanRow = {
  id_sementara: string;
  kode_rekening: string;
  sumber_dana?: string;
  tahun_anggaran: number;
  tahapan: string;
  tanggal: string;
  uraian_kegiatan: string;
  metode_pembayaran: string;
  status?: string;
  nomor_nota_dinas?: string;
  nomor_bukti?: string;
  nama_penerima?: string;
  nama_penyedia?: string;
};

type RincianRow = { id_sementara: string; nama_item: string; qty: number; satuan: string; harga_satuan: number };
type PotonganRow = { id_sementara: string; jenis_pajak: string; persentase?: number; nominal: number };

const STATUS_VALID = ["draft", "diajukan", "disetujui", "dicairkan", "ditolak"];
const TAHAPAN_VALID = ["murni", "pergeseran", "perubahan"];

function excelDateToISO(value: any): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    // serial tanggal Excel
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    const iso = `${d.y.toString().padStart(4, "0")}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    return isValidISODate(iso) ? iso : null;
  }
  const s = String(value).trim();
  // sudah format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isValidISODate(s) ? s : null;
  // format DD/MM/YYYY atau DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return isValidISODate(iso) ? iso : null; // menolak mis. 31/02/2026
  }
  // Format bebas lain TIDAK ditebak-tebak (rawan salah bulan/tanggal).
  return null;
}

export async function POST(req: Request) {
  // PENTING: route ini dulu memakai service_role TANPA cek login (dan
  // middleware mengecualikan /api/*), sehingga siapa pun di internet bisa
  // menyisipkan data ke database. Sekarang wajib login & memakai sesi user
  // (tunduk pada RLS), bukan service_role.
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Request tidak valid (harus multipart/form-data)." }, { status: 400 });
  }
  const file = formData.get("file") as File | null;
  const mode = (formData.get("mode") as string) || "preview"; // 'preview' | 'commit'

  if (!file) {
    return NextResponse.json({ error: "File tidak ditemukan. Upload file .xlsx terlebih dahulu." }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Ukuran file terlalu besar (maksimal 5 MB)." }, { status: 413 });
  }
  if (!/\.xlsx$/i.test(file.name || "")) {
    return NextResponse.json({ error: "Hanya file .xlsx yang didukung. Gunakan template yang disediakan." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  } catch (e: any) {
    return NextResponse.json({ error: "File tidak bisa dibaca sebagai Excel (.xlsx). " + e.message }, { status: 400 });
  }

  const sheetPengajuan = wb.Sheets["Pengajuan"];
  if (!sheetPengajuan) {
    return NextResponse.json({ error: "Sheet 'Pengajuan' tidak ditemukan. Gunakan template yang disediakan." }, { status: 400 });
  }
  const pengajuanRows: PengajuanRow[] = XLSX.utils.sheet_to_json(sheetPengajuan, { defval: "" });
  const rincianRows: RincianRow[] = wb.Sheets["Rincian"]
    ? XLSX.utils.sheet_to_json(wb.Sheets["Rincian"], { defval: "" })
    : [];
  const potonganRows: PotonganRow[] = wb.Sheets["Potongan"]
    ? XLSX.utils.sheet_to_json(wb.Sheets["Potongan"], { defval: "" })
    : [];

  if (pengajuanRows.length === 0) {
    return NextResponse.json({ error: "Sheet 'Pengajuan' kosong -- tidak ada baris untuk diimport." }, { status: 400 });
  }
  if (pengajuanRows.length > MAX_PENGAJUAN || rincianRows.length > MAX_RINCIAN) {
    return NextResponse.json(
      { error: `File terlalu besar: maksimal ${MAX_PENGAJUAN} pengajuan dan ${MAX_RINCIAN} baris rincian per import.` },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Ambil semua data acuan sekaligus (DENGAN paginasi, lihat fetchAll).
  let rekeningAll: any[] = [];
  let dpaAll: any[] = [];
  let penyediaAll: any[] = [];
  let pengajuanAda: any[] = [];
  try {
    rekeningAll = await fetchAll<any>((from, to) =>
      supabase
        .from("rekening_belanja")
        .select(
          "id, kode_rekening, sumber_dana, sub_kegiatan:sub_kegiatan(nama_sub_kegiatan, kegiatan:kegiatan(nama_kegiatan, program:program(nama_program)))"
        )
        .order("id")
        .range(from, to)
    );
    dpaAll = await fetchAll<any>((from, to) =>
      supabase.from("dpa").select("id, rekening_id, tahun_anggaran, tahapan, pagu_anggaran").order("id").range(from, to)
    );
    penyediaAll = await fetchAll<any>((from, to) =>
      supabase.from("penyedia").select("id, nama_penyedia").order("id").range(from, to)
    );
    pengajuanAda = await fetchAll<any>((from, to) =>
      supabase
        .from("pengajuan_belanja")
        .select("id, dpa_id, tanggal, jumlah_pengajuan, nomor_nota_dinas, nomor_bukti")
        .order("id")
        .range(from, to)
    );
  } catch (e: any) {
    return NextResponse.json({ error: "Gagal membaca data acuan dari database: " + e.message }, { status: 500 });
  }

  // Kunci duplikat: dpa + tanggal + jumlah + nomor. Dipakai agar mengunggah
  // file yang sama dua kali TIDAK menggandakan pengajuan (dan realisasi).
  const kunciDuplikat = (dpaId: string, tanggal: string, jumlah: number, nomor: string) =>
    `${dpaId}|${tanggal}|${round2(jumlah).toFixed(2)}|${nomor.trim().toLowerCase()}`;
  const sudahAda = new Set<string>(
    pengajuanAda.map((p: any) =>
      kunciDuplikat(p.dpa_id, p.tanggal, Number(p.jumlah_pengajuan), String(p.nomor_nota_dinas || p.nomor_bukti || ""))
    )
  );
  const dalamFile = new Set<string>();

  const results: any[] = [];
  const toInsert: {
    pengajuan: any;
    rincian: { nama_item: string; qty: number; satuan: string; harga_satuan: number }[];
    potongan: { jenis_pajak: string; persentase: number | null; nominal: number }[];
    id_sementara: string;
    rowNum: number;
  }[] = [];

  pengajuanRows.forEach((row, idx) => {
    const rowNum = idx + 2; // +2: baris 1 header, data mulai baris 2 di Excel
    const idSementara = String(row.id_sementara || "").trim();
    const errors: string[] = [];

    if (!idSementara) errors.push("id_sementara kosong");
    if (!row.kode_rekening) errors.push("kode_rekening kosong");
    if (!row.tahun_anggaran) errors.push("tahun_anggaran kosong");
    const tahapan = String(row.tahapan || "").trim().toLowerCase();
    if (!TAHAPAN_VALID.includes(tahapan)) errors.push(`tahapan '${row.tahapan}' tidak valid (murni/pergeseran/perubahan)`);
    const tanggalISO = excelDateToISO(row.tanggal);
    if (!tanggalISO) errors.push(`tanggal '${row.tanggal}' tidak bisa dibaca`);
    if (!row.uraian_kegiatan) errors.push("uraian_kegiatan kosong");
    const metode = String(row.metode_pembayaran || "").trim().toUpperCase();
    if (!["LS", "GU"].includes(metode)) errors.push(`metode_pembayaran '${row.metode_pembayaran}' harus LS atau GU`);
    const status = String(row.status || "dicairkan").trim().toLowerCase() || "dicairkan";
    if (!STATUS_VALID.includes(status)) errors.push(`status '${row.status}' tidak valid`);

    // cocokkan rekening (kode + opsional sumber_dana)
    const kodeRekTrim = String(row.kode_rekening || "").trim();
    const sumberDanaTrim = String(row.sumber_dana || "").trim();
    let rekeningMatches = (rekeningAll ?? []).filter((r: any) => r.kode_rekening === kodeRekTrim);
    if (sumberDanaTrim) {
      rekeningMatches = rekeningMatches.filter((r: any) => (r.sumber_dana || "").toLowerCase() === sumberDanaTrim.toLowerCase());
    }
    let rekening: any = null;
    if (rekeningMatches.length === 0) {
      errors.push(`kode_rekening '${kodeRekTrim}' tidak ditemukan di master Rekening & Pagu`);
    } else if (rekeningMatches.length > 1) {
      errors.push(`kode_rekening '${kodeRekTrim}' cocok dengan >1 baris (ada beberapa sumber dana) -- isi kolom sumber_dana untuk memilih salah satu`);
    } else {
      rekening = rekeningMatches[0];
    }

    let dpa: any = null;
    if (rekening) {
      dpa = (dpaAll ?? []).find(
        (d: any) => d.rekening_id === rekening.id && d.tahun_anggaran === Number(row.tahun_anggaran) && d.tahapan === tahapan
      );
      if (!dpa) {
        errors.push(`DPA untuk rekening ini di TA ${row.tahun_anggaran} tahapan ${tahapan} belum ada -- buat dulu di menu Rekening & Pagu`);
      }
    }

    // rincian terkait
    const rincianTerkait = rincianRows.filter((r) => String(r.id_sementara || "").trim() === idSementara);
    if (rincianTerkait.length === 0) {
      errors.push("tidak ada baris di sheet Rincian dengan id_sementara ini");
    }
    const rincianClean = rincianTerkait.map((r) => ({
      nama_item: String(r.nama_item || "").trim(),
      qty: Number(r.qty) || 0,
      satuan: String(r.satuan || "").trim(),
      harga_satuan: Number(r.harga_satuan) || 0,
    }));
    rincianClean.forEach((r, i) => {
      if (!r.nama_item) errors.push(`Rincian #${i + 1}: nama_item kosong`);
      if (r.qty <= 0) errors.push(`Rincian #${i + 1}: qty harus > 0`);
      if (r.harga_satuan <= 0) errors.push(`Rincian #${i + 1}: harga_satuan harus > 0`);
    });
    const jumlahPengajuan = round2(rincianClean.reduce((s, r) => s + round2(r.qty * r.harga_satuan), 0));

    // potongan terkait (opsional)
    const potonganTerkait = potonganRows.filter((p) => String(p.id_sementara || "").trim() === idSementara);
    const potonganClean = potonganTerkait
      .filter((p) => p.jenis_pajak)
      .map((p) => ({
        jenis_pajak: String(p.jenis_pajak).trim(),
        persentase: (p.persentase as any) !== "" && p.persentase !== undefined ? Number(p.persentase) : null,
        nominal: round2(Math.max(0, Number(p.nominal) || 0)),
      }));

    // penyedia (khusus LS)
    let penyediaId: string | null = null;
    let penyediaBaru = false;
    const namaPenyediaTrim = String(row.nama_penyedia || "").trim();
    if (metode === "LS") {
      if (!namaPenyediaTrim) {
        errors.push("metode LS tapi nama_penyedia kosong");
      } else {
        const existing = (penyediaAll ?? []).find(
          (p: any) => p.nama_penyedia.toLowerCase() === namaPenyediaTrim.toLowerCase()
        );
        if (existing) {
          penyediaId = existing.id;
        } else {
          penyediaBaru = true; // akan dibuat saat commit
        }
      }
    }

    // Deteksi duplikat (hanya kalau ada nomor Nota Dinas / Bukti, supaya dua
    // belanja sah di hari & nominal sama tanpa nomor tidak ikut terblokir).
    const nomorDup = String(row.nomor_nota_dinas || row.nomor_bukti || "").trim();
    if (dpa && tanggalISO && nomorDup) {
      const kunci = kunciDuplikat(dpa.id, tanggalISO, jumlahPengajuan, nomorDup);
      if (sudahAda.has(kunci)) {
        errors.push("DUPLIKAT: pengajuan dengan rekening, tanggal, jumlah, dan nomor yang sama sudah ada di database");
      } else if (dalamFile.has(kunci)) {
        errors.push("DUPLIKAT: baris ini kembar dengan baris lain di file yang sama");
      } else {
        dalamFile.add(kunci);
      }
    }

    const breadcrumb = rekening
      ? [
          rekening.sub_kegiatan?.kegiatan?.program?.nama_program,
          rekening.sub_kegiatan?.kegiatan?.nama_kegiatan,
          rekening.sub_kegiatan?.nama_sub_kegiatan,
        ]
          .filter(Boolean)
          .join(" > ")
      : null;

    const rowResult = {
      row: rowNum,
      id_sementara: idSementara,
      kode_rekening: kodeRekTrim,
      breadcrumb,
      uraian_kegiatan: row.uraian_kegiatan,
      jumlah_pengajuan: jumlahPengajuan,
      jumlah_item_rincian: rincianClean.length,
      penyedia_baru: penyediaBaru ? namaPenyediaTrim : null,
      ok: errors.length === 0,
      errors,
    };
    results.push(rowResult);

    if (errors.length === 0 && dpa) {
      toInsert.push({
        id_sementara: idSementara,
        rowNum,
        pengajuan: {
          dpa_id: dpa.id,
          tanggal: tanggalISO,
          uraian_kegiatan: String(row.uraian_kegiatan).trim(),
          jumlah_pengajuan: jumlahPengajuan,
          penyedia_id: penyediaId, // diisi ulang saat commit kalau penyediaBaru
          nama_penerima: metode === "GU" ? String(row.nama_penerima || "").trim() || null : null,
          status,
          metode_pembayaran: metode,
          nomor_nota_dinas: String(row.nomor_nota_dinas || "").trim() || null,
          nomor_bukti: String(row.nomor_bukti || "").trim() || null,
          _nama_penyedia_baru: penyediaBaru ? namaPenyediaTrim : null,
        },
        rincian: rincianClean,
        potongan: potonganClean,
      });
    }
  });

  const summary = {
    total: results.length,
    valid: results.filter((r) => r.ok).length,
    error: results.filter((r) => !r.ok).length,
  };

  if (mode === "preview") {
    return NextResponse.json({ mode: "preview", summary, results });
  }

  // ---- mode = commit: eksekusi insert untuk baris yang valid ----
  const commitResults: { row: number; id_sementara: string; ok: boolean; message: string }[] = [];

  // Penyedia baru yang sudah dibuat selama commit ini (nama kecil -> id).
  // Tanpa peta ini, dua baris LS dengan penyedia baru yang SAMA membuat
  // insert kedua gagal (unique nama_penyedia) -- pengajuan ke-2 ikut gagal.
  const penyediaDibuat = new Map<string, string>();

  for (const item of toInsert) {
    let pengajuanId: string | null = null;
    try {
      let penyediaId = item.pengajuan.penyedia_id;
      const namaPenyediaBaru: string | null = item.pengajuan._nama_penyedia_baru;
      if (!penyediaId && namaPenyediaBaru) {
        const key = namaPenyediaBaru.toLowerCase();
        const dibuat = penyediaDibuat.get(key);
        if (dibuat) {
          penyediaId = dibuat;
        } else {
          const { data: newPenyedia, error: errPenyedia } = await supabase
            .from("penyedia")
            .insert({ nama_penyedia: namaPenyediaBaru })
            .select("id")
            .single();
          if (errPenyedia || !newPenyedia) throw new Error("Gagal buat penyedia baru: " + (errPenyedia?.message || "tidak diketahui"));
          penyediaId = newPenyedia.id;
          penyediaDibuat.set(key, newPenyedia.id);
        }
      }

      const { _nama_penyedia_baru, ...pengajuanInsert } = item.pengajuan;
      const { data: pengajuan, error: errPengajuan } = await supabase
        .from("pengajuan_belanja")
        .insert({ ...pengajuanInsert, penyedia_id: penyediaId, dibuat_oleh: auth.user.id })
        .select("id")
        .single();
      if (errPengajuan || !pengajuan) throw new Error(errPengajuan?.message || "Gagal menyimpan pengajuan");
      pengajuanId = pengajuan.id;

      const { error: errRincian } = await supabase.from("rincian_belanja").insert(
        item.rincian.map((r) => ({
          pengajuan_id: pengajuan.id,
          nama_item: r.nama_item,
          qty: r.qty,
          satuan: r.satuan,
          harga_satuan: r.harga_satuan,
        }))
      );
      if (errRincian) throw new Error("Rincian: " + errRincian.message);

      if (item.potongan.length > 0) {
        // Isi `tipe` eksplisit (default 'potongan') supaya konsisten dgn
        // rute create/update -- lihat komentar di app/api/pengajuan/route.ts.
        const { error: errPotongan } = await supabase.from("potongan_pajak").insert(
          item.potongan.map((p) => ({
            pengajuan_id: pengajuan.id,
            jenis_pajak: p.jenis_pajak,
            persentase: p.persentase,
            nominal: p.nominal,
            tipe: "potongan",
          }))
        );
        if (errPotongan) throw new Error("Potongan: " + errPotongan.message);
      }

      commitResults.push({ row: item.rowNum, id_sementara: item.id_sementara, ok: true, message: "Berhasil diimport" });
    } catch (e: any) {
      // Batalkan header yang sudah terlanjur dibuat (rincian/potongan ikut
      // terhapus lewat ON DELETE CASCADE) supaya tidak ada pengajuan
      // setengah jadi yang ikut menghitung realisasi.
      if (pengajuanId) await supabase.from("pengajuan_belanja").delete().eq("id", pengajuanId);
      commitResults.push({ row: item.rowNum, id_sementara: item.id_sementara, ok: false, message: e.message });
    }
  }

  return NextResponse.json({
    mode: "commit",
    summary: {
      ...summary,
      diimport: commitResults.filter((r) => r.ok).length,
      gagalImport: commitResults.filter((r) => !r.ok).length,
    },
    results,
    commitResults,
  });
}
