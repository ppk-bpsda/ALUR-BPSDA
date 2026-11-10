import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPeriode, tahapanLabel } from "@/lib/periode";
import { ambilSemua } from "@/lib/anggaran/muat";
import { KOLOM_FORMAT } from "@/lib/anggaran/pagu";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Unduh FORMAT ISIAN TETAP pagu (satu berkas untuk seluruh tahapan), terisi data terbaru
 * dari database untuk Tahun Anggaran aktif: satu baris = satu rekening, tiga kolom pagu
 * (Murni / Pergeseran / Perubahan). Saat tahapan berikutnya, cukup ubah kolom pagu tahapan
 * itu -- kolom lain (termasuk id_rekening) jangan diubah kecuali memang mengoreksi kode.
 * ?kosong=1 -> hanya judul kolom + satu baris contoh (untuk tahun anggaran baru).
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { tahun, tahapan } = await getPeriode();
  const kosong = req.nextUrl.searchParams.get("kosong") === "1";

  try {
    const supabase = await createClient();
    const sel = (v: unknown) => (v === undefined || v === null ? "" : String(v));
    let data: any[][] = [];
    let katalog: any[] = [];
    let sumber: any[] = [];

    const [rek, dpa, pptk, katalogR, sumberR] = await Promise.all([
      kosong ? [] : ambilSemua<any>((a, b) =>
        supabase.from("rekening_belanja")
          .select("id, kode_rekening, jenis_belanja, kelompok_belanja, sumber_dana, sub_kegiatan!inner(kode_sub_kegiatan, nama_sub_kegiatan, tahun_anggaran, kegiatan!inner(kode_kegiatan, nama_kegiatan, program!inner(kode_program, nama_program)))")
          .eq("sub_kegiatan.tahun_anggaran", tahun).order("kode_rekening").range(a, b)),
      kosong ? [] : ambilSemua<any>((a, b) => supabase.from("dpa").select("rekening_id, tahapan, pagu_anggaran, pptk_id").eq("tahun_anggaran", tahun).order("id").range(a, b)),
      kosong ? [] : ambilSemua<any>((a, b) => supabase.from("pejabat_skpd").select("id, nama").eq("jabatan", "PPTK").eq("tahun_anggaran", tahun).order("id").range(a, b)),
      ambilSemua<any>((a, b) => supabase.from("ref_belanja").select("kode_belanja, nama_belanja").order("kode_belanja").range(a, b)).catch(() => []),
      ambilSemua<any>((a, b) => supabase.from("ref_sumber_dana").select("nama").order("id").range(a, b)).catch(() => []),
    ]);
    katalog = katalogR; sumber = sumberR;

    const pptkNama = new Map<string, string>(pptk.map((p: any) => [p.id, p.nama]));
    const paguPer = new Map<string, Record<string, number>>();
    const pptkPer = new Map<string, string>();
    for (const d of dpa) {
      const m = paguPer.get(d.rekening_id) ?? {};
      m[d.tahapan] = Number(d.pagu_anggaran);
      paguPer.set(d.rekening_id, m);
      if (d.pptk_id && pptkNama.has(d.pptk_id)) pptkPer.set(d.rekening_id, pptkNama.get(d.pptk_id)!);
    }

    if (kosong) {
      data = [["4.01.01", "Nama Program", "4.01.01.2.01", "Nama Kegiatan", "4.01.01.2.01.0001", "Nama Sub Kegiatan",
        "4.01.01.2.01.0001.5.1.02.01.001.00024", "Belanja Alat Tulis Kantor", "Belanja Barang/Jasa", "PAD", 50000000, "", "", "Nama PPTK", ""]];
    } else {
      data = rek.map((r: any) => {
        const sk = r.sub_kegiatan, keg = sk?.kegiatan, prog = keg?.program;
        const p = paguPer.get(r.id) ?? {};
        return [
          sel(prog?.kode_program), sel(prog?.nama_program), sel(keg?.kode_kegiatan), sel(keg?.nama_kegiatan),
          sel(sk?.kode_sub_kegiatan), sel(sk?.nama_sub_kegiatan),
          sel(r.kode_rekening), sel(r.jenis_belanja), sel(r.kelompok_belanja), sel(r.sumber_dana),
          p.murni ?? "", p.pergeseran ?? "", p.perubahan ?? "",
          sel(pptkPer.get(r.id)), r.id,
        ];
      }).sort((a: any[], b: any[]) => String(a[6]).localeCompare(String(b[6])) || String(a[9]).localeCompare(String(b[9])));
    }

    const ws = XLSX.utils.aoa_to_sheet([Array.from(KOLOM_FORMAT), ...data]);
    // kolom kode/ID wajib bertipe TEKS agar Excel tidak mengubahnya (mis. memotong angka nol)
    const teks = new Set([0, 2, 4, 6, 14]);
    data.forEach((row, i) => row.forEach((v, c) => {
      const ref = XLSX.utils.encode_cell({ r: i + 1, c });
      const cell = ws[ref];
      if (!cell) return;
      if (teks.has(c)) { cell.t = "s"; cell.v = String(v); }
      if (c >= 10 && c <= 12 && typeof v === "number") { cell.t = "n"; cell.z = "#,##0.00"; }
    }));
    ws["!cols"] = [10, 28, 14, 28, 18, 34, 38, 38, 20, 12, 18, 18, 18, 24, 38].map((wch) => ({ wch }));
    ws["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(KOLOM_FORMAT.length - 1)}${Math.max(2, data.length + 1)}` };

    const petunjuk = XLSX.utils.aoa_to_sheet([
      ["FORMAT ISIAN PAGU ANGGARAN (satu format untuk Murni / Pergeseran / Perubahan)"],
      [`Dibuat dari data aplikasi: Tahun Anggaran ${tahun}. Periode aktif saat diunduh: ${tahapanLabel(tahapan)}.`],
      [],
      ["CARA PAKAI"],
      ["1. Menyesuaikan pagu tahapan baru (mis. Pergeseran): ubah HANYA kolom pagu_pergeseran. Kolom pagu tahapan lain tidak diimpor."],
      ["2. Di aplikasi: pilih periode (tahun + tahapan) yang sama, buka Input Anggaran > Unggah dari Excel, unggah berkas, periksa pratinjau, lalu Simpan."],
      ["3. Baris dengan pagu tahapan aktif KOSONG dilewati (tidak diubah). Isi 0 bila memang ingin menolkan pagu."],
      ["4. Menambah rekening baru: tambahkan baris di bawah, kosongkan id_rekening. Isi kode_sub_kegiatan, kode_rekening (lengkap atau 6 segmen), uraian_belanja, sumber_dana, dan pagu."],
      ["   Sub kegiatan/kegiatan/program yang belum ada dibuat otomatis bila nama_* diisi."],
      ["5. MENGOREKSI kode rekening / uraian / sumber dana yang salah: ubah langsung di barisnya dan JANGAN hapus id_rekening. Sistem mengenalinya sebagai koreksi (bukan rekening baru),"],
      ["   meminta konfirmasi, dan mencatat kode LAMA -> BARU di Riwayat Pagu. Koreksi berlaku untuk semua tahapan."],
      ["6. Jangan menghapus baris untuk menghapus rekening -- penghapusan dilakukan di menu Input Anggaran."],
      ["7. Kode rekening = kode sub kegiatan + kode belanja 6 segmen. Contoh: 4.01.01.2.01.0001.5.1.02.01.001.00024. Sheet 'Katalog Belanja' berisi kode belanja resmi."],
      ["8. Angka ditulis tanpa 'Rp'. Pemisah ribuan boleh. Jangan menggabung sel / menambah baris judul di atas."],
      ["9. Sebelum Simpan, aplikasi menandai: kode belanja di luar katalog (disertai saran kode mirip), rekening dobel beda sumber dana, pagu < realisasi, dan perubahan di kolom tahapan lain."],
    ]);
    petunjuk["!cols"] = [{ wch: 160 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagu");
    XLSX.utils.book_append_sheet(wb, petunjuk, "Petunjuk");
    if (katalog.length) {
      const k = XLSX.utils.aoa_to_sheet([["kode_belanja", "nama_belanja"], ...katalog.map((x: any) => [x.kode_belanja, x.nama_belanja])]);
      k["!cols"] = [{ wch: 20 }, { wch: 70 }];
      XLSX.utils.book_append_sheet(wb, k, "Katalog Belanja");
    }
    if (sumber.length) {
      const s = XLSX.utils.aoa_to_sheet([["sumber_dana"], ...sumber.map((x: any) => [x.nama])]);
      s["!cols"] = [{ wch: 30 }];
      XLSX.utils.book_append_sheet(wb, s, "Sumber Dana");
    }

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const nama = `format-pagu-${tahun}${kosong ? "-kosong" : ""}.xlsx`;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nama}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal membuat berkas." }, { status: 500 });
  }
}
