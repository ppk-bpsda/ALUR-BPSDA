import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/terbilang";
import { getPeriode, tahapanLabel } from "@/lib/periode";
import GenerateButtons from "../pengajuan/GenerateButtons";

// Rekap Dokumen -- daftar semua Pengajuan Belanja (yang masing-masing bisa
// dicetak jadi Nota Dinas, SPP/SPTJB, dan Kuitansi GU) untuk Tahun
// Anggaran + Tahapan yang sedang aktif (lihat menu akun kanan atas),
// dengan filter tambahan: rentang tanggal, Program, Kegiatan, Sub
// Kegiatan, Belanja (rekening), Sumber Dana, dan PPTK.
//
// CATATAN: dokumen (Nota Dinas/SPP/Kuitansi) di aplikasi ini dibuat
// langsung dari data Pengajuan Belanja saat tombolnya diklik (tidak
// disimpan sebagai file terpisah) -- jadi "rekap dokumen" pada dasarnya
// adalah rekap Pengajuan Belanja itu sendiri, lengkap dengan tombol untuk
// membuka/mencetak ketiga jenis dokumennya per baris.

type SearchParams = {
  dari?: string;
  sampai?: string;
  program_id?: string;
  kegiatan_id?: string;
  sub_kegiatan_id?: string;
  rekening_id?: string;
  sumber_dana?: string;
  pptk_id?: string;
};

export default async function RekapDokumenPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { tahun, tahapan } = getPeriode();
  const supabase = createClient();
  const {
    dari = "",
    sampai = "",
    program_id = "",
    kegiatan_id = "",
    sub_kegiatan_id = "",
    rekening_id = "",
    sumber_dana = "",
    pptk_id = "",
  } = searchParams;

  // ---------------------------------------------------------
  // Opsi filter -- semua di-scope ke Tahun Anggaran + Tahapan yang aktif
  // ---------------------------------------------------------
  const [{ data: programs }, { data: kegiatans }, { data: subKegiatans }, { data: rekenings }, { data: pptks }] =
    await Promise.all([
      supabase
        .from("program")
        .select("id, kode_program, nama_program")
        .eq("tahun_anggaran", tahun)
        .order("kode_program"),
      supabase
        .from("kegiatan")
        .select("id, kode_kegiatan, nama_kegiatan, program_id")
        .eq("tahun_anggaran", tahun)
        .order("kode_kegiatan"),
      supabase
        .from("sub_kegiatan")
        .select("id, kode_sub_kegiatan, nama_sub_kegiatan, kegiatan_id")
        .eq("tahun_anggaran", tahun)
        .order("kode_sub_kegiatan"),
      supabase
        .from("rekening_belanja")
        .select("id, kode_rekening, keterangan, sumber_dana, sub_kegiatan_id, sub_kegiatan:sub_kegiatan!inner(tahun_anggaran)")
        .eq("sub_kegiatan.tahun_anggaran", tahun)
        .order("kode_rekening"),
      supabase
        .from("pejabat_skpd")
        .select("id, nama")
        .eq("jabatan", "PPTK")
        .eq("tahun_anggaran", tahun)
        .order("nama"),
    ]);

  const kegiatanOptions = (kegiatans ?? []).filter((k: any) => !program_id || k.program_id === program_id);
  const subKegiatanOptions = (subKegiatans ?? []).filter((s: any) => !kegiatan_id || s.kegiatan_id === kegiatan_id);
  const rekeningOptions = (rekenings ?? []).filter(
    (r: any) => !sub_kegiatan_id || r.sub_kegiatan_id === sub_kegiatan_id
  );
  const sumberDanaOptions = Array.from(new Set((rekenings ?? []).map((r: any) => r.sumber_dana))).sort();

  // ---------------------------------------------------------
  // Query utama -- pakai !inner di setiap level yang mungkin difilter,
  // supaya filter pada kolom relasi benar-benar membatasi baris (bukan
  // cuma membatasi apa yang di-embed).
  // ---------------------------------------------------------
  let query = supabase
    .from("pengajuan_belanja")
    .select(
      `
      id, tanggal, uraian_kegiatan, jumlah_pengajuan, metode_pembayaran, status, nomor_nota_dinas, nomor_bukti,
      dpa:dpa!inner (
        tahun_anggaran, tahapan, pptk_id,
        pptk:pejabat_skpd ( id, nama ),
        rekening:rekening_belanja!inner (
          id, kode_rekening, keterangan, sumber_dana,
          sub_kegiatan:sub_kegiatan!inner (
            id, kode_sub_kegiatan, nama_sub_kegiatan,
            kegiatan:kegiatan!inner (
              id, kode_kegiatan, nama_kegiatan,
              program:program!inner ( id, kode_program, nama_program )
            )
          )
        )
      )
    `
    )
    .eq("dpa.tahun_anggaran", tahun)
    .eq("dpa.tahapan", tahapan)
    .order("tanggal", { ascending: false });

  if (dari) query = query.gte("tanggal", dari);
  if (sampai) query = query.lte("tanggal", sampai);
  if (pptk_id) query = query.eq("dpa.pptk_id", pptk_id);
  if (sumber_dana) query = query.eq("dpa.rekening.sumber_dana", sumber_dana);
  if (rekening_id) query = query.eq("dpa.rekening_id", rekening_id);
  if (sub_kegiatan_id) query = query.eq("dpa.rekening.sub_kegiatan_id", sub_kegiatan_id);
  if (kegiatan_id) query = query.eq("dpa.rekening.sub_kegiatan.kegiatan_id", kegiatan_id);
  if (program_id) query = query.eq("dpa.rekening.sub_kegiatan.kegiatan.program_id", program_id);

  const { data: list } = await query;
  const rows = (list ?? []) as any[];
  const totalJumlah = rows.reduce((s, r) => s + Number(r.jumlah_pengajuan || 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-xl text-slate-900">Rekap Dokumen</h1>
        <p className="text-sm text-slate-500">
          Nota Dinas, SPP/SPTJB &amp; Kuitansi -- Tahun Anggaran {tahun}, Tahapan {tahapanLabel(tahapan)}.
        </p>
      </div>

      {/* Filter -- form GET biasa, hasil difilter lewat query string */}
      <form className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Dari Tanggal</label>
          <input
            type="date"
            name="dari"
            defaultValue={dari}
            className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Sampai Tanggal</label>
          <input
            type="date"
            name="sampai"
            defaultValue={sampai}
            className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Program</label>
          <select
            name="program_id"
            defaultValue={program_id}
            className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5"
          >
            <option value="">Semua Program</option>
            {(programs ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.nama_program}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Kegiatan</label>
          <select
            name="kegiatan_id"
            defaultValue={kegiatan_id}
            className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5"
          >
            <option value="">Semua Kegiatan</option>
            {kegiatanOptions.map((k: any) => (
              <option key={k.id} value={k.id}>
                {k.nama_kegiatan}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Sub Kegiatan</label>
          <select
            name="sub_kegiatan_id"
            defaultValue={sub_kegiatan_id}
            className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5"
          >
            <option value="">Semua Sub Kegiatan</option>
            {subKegiatanOptions.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.nama_sub_kegiatan}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Belanja</label>
          <select
            name="rekening_id"
            defaultValue={rekening_id}
            className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5"
          >
            <option value="">Semua Belanja</option>
            {rekeningOptions.map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.keterangan || r.kode_rekening}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Sumber Dana</label>
          <select
            name="sumber_dana"
            defaultValue={sumber_dana}
            className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5"
          >
            <option value="">Semua Sumber Dana</option>
            {sumberDanaOptions.map((sd) => (
              <option key={sd} value={sd}>
                {sd}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">PPTK</label>
          <select
            name="pptk_id"
            defaultValue={pptk_id}
            className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5"
          >
            <option value="">Semua PPTK</option>
            {(pptks ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.nama}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 md:col-span-4 flex justify-end gap-2 pt-1">
          <a
            href="/rekap-dokumen"
            className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5"
          >
            Reset
          </a>
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-1.5"
          >
            Terapkan Filter
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="font-medium px-4 py-2.5">Tanggal</th>
              <th className="font-medium px-4 py-2.5">Program / Kegiatan / Sub Kegiatan</th>
              <th className="font-medium px-4 py-2.5">Belanja</th>
              <th className="font-medium px-4 py-2.5">Sumber Dana</th>
              <th className="font-medium px-4 py-2.5">PPTK</th>
              <th className="font-medium px-4 py-2.5">Uraian</th>
              <th className="font-medium px-4 py-2.5">Jumlah</th>
              <th className="font-medium px-4 py-2.5">Dokumen</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400 text-sm">
                  Tidak ada Pengajuan Belanja yang cocok dengan filter ini.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const dpa = row.dpa;
              const rek = dpa?.rekening;
              const subKeg = rek?.sub_kegiatan;
              const keg = subKeg?.kegiatan;
              const program = keg?.program;
              return (
                <tr key={row.id} className="border-b border-slate-50 last:border-0 align-top">
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{row.tanggal}</td>
                  <td className="px-4 py-3 text-slate-700 max-w-xs">
                    <p className="text-xs text-slate-400">{program?.nama_program}</p>
                    <p className="text-xs text-slate-400">{keg?.nama_kegiatan}</p>
                    <p>{subKeg?.nama_sub_kegiatan}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-xs">
                    <p>{rek?.keterangan}</p>
                    <p className="font-mono text-xs text-slate-400">{rek?.kode_rekening}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{rek?.sumber_dana}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{dpa?.pptk?.nama}</td>
                  <td className="px-4 py-3 text-slate-700 max-w-sm truncate">{row.uraian_kegiatan}</td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    Rp {formatRupiah(row.jumlah_pengajuan)}
                  </td>
                  <td className="px-4 py-3">
                    <GenerateButtons pengajuanId={row.id} metodePembayaran={row.metode_pembayaran || "GU"} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 font-medium">
                <td colSpan={6} className="px-4 py-3 text-right text-slate-500 text-xs">
                  Total ({rows.length} dokumen)
                </td>
                <td className="px-4 py-3 text-slate-900 whitespace-nowrap">Rp {formatRupiah(totalJumlah)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
