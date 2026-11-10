import { createClient } from "@/lib/supabase/server";
import { getPeriode, tahapanLabel, TAHAPAN_OPTIONS } from "@/lib/periode";
import { addRekening, updateRekening, deleteRekening, addKegiatan, addSubKegiatan, salinDariTahapan } from "./actions";
import { formatRupiah } from "@/lib/terbilang";
import { kodeRekeningBelanja } from "@/lib/format";
import { ambilSemua } from "@/lib/anggaran/muat";
import Link from "next/link";
import { Trash2, Copy, FileSpreadsheet, Download, History, CheckCircle2, ShieldCheck } from "lucide-react";
import TambahRekeningFields from "./TambahRekeningFields";

export default async function RekeningPage(props: { searchParams: Promise<{ ok?: string; q?: string; sub?: string; halaman?: string }> }) {
  const sp = await props.searchParams;
  const { tahun, tahapan } = await getPeriode();
  const supabase = await createClient();

  const [
    { data: dpaList },
    { data: subKegiatan },
    { data: pptkList },
    { data: program },
    { data: kegiatan },
    { data: katalogBelanja },
    { data: sumberDanaRef },
  ] =
    await Promise.all([
      ambilSemua<any>((a, b) =>
        supabase
          .from("dpa")
          .select(
            "id, pagu_anggaran, pptk_id, rekening:rekening_belanja(id, kode_rekening, jenis_belanja, kelompok_belanja, sumber_dana, sub_kegiatan_id, sub_kegiatan:sub_kegiatan(kode_sub_kegiatan, nama_sub_kegiatan))"
          )
          .eq("tahun_anggaran", tahun)
          .eq("tahapan", tahapan)
          .order("id")
          .range(a, b)
      ).then((data) => ({ data })),
      supabase
        .from("sub_kegiatan")
        .select("id, kode_sub_kegiatan, nama_sub_kegiatan")
        .eq("tahun_anggaran", tahun)
        .order("kode_sub_kegiatan"),
      supabase
        .from("pejabat_skpd")
        .select("id, nama, sub_kegiatan_id")
        .eq("jabatan", "PPTK")
        .eq("tahun_anggaran", tahun)
        .order("nama"),
      supabase.from("program").select("id, kode_program, nama_program").eq("tahun_anggaran", tahun).order("kode_program"),
      supabase
        .from("kegiatan")
        .select("id, kode_kegiatan, nama_kegiatan, program_id")
        .eq("tahun_anggaran", tahun)
        .order("kode_kegiatan"),
      // Katalog referensi (tabel ref_belanja / ref_sumber_dana). Kalau migrasi
      // belum dijalankan, query ini mengembalikan data kosong -- halaman tetap normal.
      supabase.from("ref_belanja").select("kode_belanja, nama_belanja").order("kode_belanja"),
      supabase.from("ref_sumber_dana").select("nama").order("nama"),
    ]);

  // Pilihan sumber dana = katalog + nilai yang sudah terpakai di baris rekening (tanpa duplikat)
  const sumberDanaOpsi = Array.from(
    new Map(
      [
        ...(sumberDanaRef ?? []).map((r: any) => String(r.nama ?? "").trim()),
        ...(dpaList ?? []).map((r: any) => String(r.rekening?.sumber_dana ?? "").trim()),
      ]
        .filter(Boolean)
        .map((v) => [v.toLowerCase(), v] as const)
    ).values()
  ).sort((a, b) => a.localeCompare(b));

  // Urut menurut sub kegiatan lalu kode rekening (sebelumnya urut acak menurut ID) + pencarian + halaman
  const urutan = [...(dpaList ?? [])].sort(
    (a: any, b: any) =>
      String(a.rekening?.sub_kegiatan?.kode_sub_kegiatan).localeCompare(String(b.rekening?.sub_kegiatan?.kode_sub_kegiatan)) ||
      String(a.rekening?.kode_rekening).localeCompare(String(b.rekening?.kode_rekening)) ||
      String(a.rekening?.sumber_dana).localeCompare(String(b.rekening?.sumber_dana))
  );
  const q = String(sp.q ?? "").trim().toLowerCase().slice(0, 80);
  const subFilter = String(sp.sub ?? "");
  const terfilter = urutan.filter((r: any) => {
    if (subFilter && r.rekening?.sub_kegiatan_id !== subFilter) return false;
    if (!q) return true;
    return `${r.rekening?.kode_rekening} ${r.rekening?.jenis_belanja} ${r.rekening?.sumber_dana}`.toLowerCase().includes(q);
  });
  const PER_HALAMAN = 100;
  const totalHalaman = Math.max(1, Math.ceil(terfilter.length / PER_HALAMAN));
  const halaman = Math.min(totalHalaman, Math.max(1, Number(sp.halaman) || 1));
  const barisHalaman = terfilter.slice((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN);
  const hrefHal = (h: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (subFilter) p.set("sub", subFilter);
    if (h > 1) p.set("halaman", String(h));
    const t = p.toString();
    return `/rekening${t ? `?${t}` : ""}`;
  };
  const totalPagu = (dpaList ?? []).reduce((s, r: any) => s + Number(r.pagu_anggaran || 0), 0);
  const tahapanLain = TAHAPAN_OPTIONS.filter((t) => t.value !== tahapan);

  return (
    <div className="space-y-6">
      <datalist id="daftar-sumber-dana">
        {sumberDanaOpsi.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <div>
        <h1 className="font-serif text-xl text-slate-900">Rekening &amp; Pagu (DPA)</h1>
        <p className="text-sm text-slate-500">
          Tahun Anggaran {tahun}, Tahapan {tahapanLabel(tahapan)}. Tambah/edit/hapus rekening dan pagu
          untuk tahapan ini -- ganti periode lewat menu akun di kanan atas untuk mengelola tahapan lain.
        </p>
      </div>

      {sp.ok && <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" /> {sp.ok}</p>}

      <div className="flex flex-wrap gap-2">
        <Link href="/rekening/import" className="btn-primary"><FileSpreadsheet className="h-4 w-4" /> Impor / perbarui pagu dari Excel</Link>
        <a href="/api/rekening/format" className="btn-secondary"><Download className="h-4 w-4" /> Unduh format isian (Excel)</a>
        <Link href="/rekening/pemeriksaan" className="btn-secondary"><ShieldCheck className="h-4 w-4" /> Pemeriksaan data</Link>
        <Link href="/rekening/riwayat" className="btn-secondary"><History className="h-4 w-4" /> Riwayat perubahan</Link>
        <Link href="/rekap-pagu" className="btn-secondary">Perbandingan pagu antartahapan</Link>
        <Link href="/anggaran-kas" className="btn-secondary">Anggaran kas triwulanan</Link>
      </div>

      {tahapanLain.length > 0 && (
        <form
          action={salinDariTahapan}
          className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap items-end gap-3"
        >
          <Copy className="h-5 w-5 text-amber-600 shrink-0 mb-1.5" />
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-medium text-slate-900">Salin dari tahapan lain</p>
            <p className="text-xs text-slate-500">
              Mengisi tahapan {tahapanLabel(tahapan)} dari baseline tahapan lain -- rekening yang sudah
              punya pagu di {tahapanLabel(tahapan)} tidak akan ditimpa, hanya yang belum ada yang ditambahkan.
            </p>
          </div>
          <select
            name="dari_tahapan"
            defaultValue={tahapanLain[0]?.value}
            className="text-sm border border-amber-300 rounded-lg px-2.5 py-1.5 outline-none bg-white"
          >
            {tahapanLain.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            Salin Sekarang
          </button>
        </form>
      )}

      <form method="get" className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs font-medium text-slate-600 block mb-1">Cari kode rekening / uraian / sumber dana</label>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="mis. 5.1.02.01.001.00024 atau alat tulis" className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white" />
        </div>
        <div className="min-w-[220px]">
          <label className="text-xs font-medium text-slate-600 block mb-1">Sub kegiatan</label>
          <select name="sub" defaultValue={subFilter} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">
            <option value="">Semua sub kegiatan</option>
            {(subKegiatan ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.kode_sub_kegiatan} — {s.nama_sub_kegiatan}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-primary">Cari</button>
        {(q || subFilter) && <Link href="/rekening" className="text-xs text-slate-500 hover:underline pb-2">Reset</Link>}
        <p className="text-xs text-slate-500 pb-2 ml-auto">{terfilter.length} dari {urutan.length} rekening · total pagu {formatRupiah(totalPagu)}</p>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="font-medium px-3 py-2.5">Sub Kegiatan</th>
              <th className="font-medium px-3 py-2.5">Kode Rekening</th>
              <th className="font-medium px-3 py-2.5">Uraian Belanja</th>
              <th className="font-medium px-3 py-2.5">Kelompok</th>
              <th className="font-medium px-3 py-2.5">Sumber Dana</th>
              <th className="font-medium px-3 py-2.5">PPTK</th>
              <th className="font-medium px-3 py-2.5">Pagu ({tahapanLabel(tahapan)})</th>
              <th className="font-medium px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {terfilter.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-400 text-sm">
                  {urutan.length === 0 ? "Belum ada rekening di tahapan ini. Tambahkan lewat form di bawah." : "Tidak ada rekening yang cocok dengan pencarian."}
                </td>
              </tr>
            )}
            {barisHalaman.map((row: any) => (
              <tr key={row.id} className="border-b border-slate-50 last:border-0 align-top">
                <form action={updateRekening} className="contents">
                  <input type="hidden" name="dpa_id" value={row.id} />
                  <input type="hidden" name="rekening_id" value={row.rekening?.id} />
                  <input type="hidden" name="pagu_lama" value={row.pagu_anggaran} />
                  <td className="px-3 py-2">
                    <select
                      name="sub_kegiatan_id"
                      defaultValue={row.rekening?.sub_kegiatan_id}
                      className="w-56 text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none bg-white"
                    >
                      {(subKegiatan ?? []).map((sk: any) => (
                        <option key={sk.id} value={sk.id}>
                          {sk.kode_sub_kegiatan} -- {sk.nama_sub_kegiatan}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      name="kode_rekening"
                      defaultValue={row.rekening?.kode_rekening}
                      className="w-56 text-xs font-mono border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Kode Rekening Belanja: {kodeRekeningBelanja(row.rekening?.kode_rekening)}
                    </p>
                    <label className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 cursor-pointer" title="Centang hanya bila Anda mengubah kode dan kode baru memang tidak ada di katalog resmi">
                      <input type="checkbox" name="di_luar_katalog" value="1" className="accent-[#237469]" /> kode di luar katalog
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      name="jenis_belanja"
                      defaultValue={row.rekening?.jenis_belanja}
                      placeholder="mis. Belanja Honorarium..."
                      className="w-56 text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      name="kelompok_belanja"
                      defaultValue={row.rekening?.kelompok_belanja || "Belanja Barang/Jasa"}
                      title='Menentukan isi kolom "Jenis Rek." di Nota Dinas'
                      className="w-40 text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none bg-white"
                    >
                      <option value="Belanja Barang/Jasa">Belanja Barang/Jasa</option>
                      <option value="Belanja Modal">Belanja Modal</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      name="sumber_dana"
                      list="daftar-sumber-dana"
                      defaultValue={row.rekening?.sumber_dana}
                      className="w-24 text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      name="pptk_id"
                      defaultValue={row.pptk_id ?? ""}
                      className="w-40 text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none bg-white"
                    >
                      <option value="">-- pilih PPTK --</option>
                      {(pptkList ?? []).map((p: any) => (
                        <option key={p.id} value={p.id}>{p.nama}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      name="pagu_anggaran"
                      defaultValue={row.pagu_anggaran}
                      className="w-32 text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1.5">
                      <button
                        type="submit"
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-1.5"
                      >
                        Simpan
                      </button>
                      <button
                        type="submit"
                        formAction={deleteRekening}
                        className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg px-2 py-1.5 flex items-center"
                        title="Hapus rekening ini dari tahapan aktif"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </form>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-medium">
              <td className="px-3 py-2.5" colSpan={6}>TOTAL PAGU ({tahapanLabel(tahapan)})</td>
              <td className="px-3 py-2.5" colSpan={2}>Rp {formatRupiah(totalPagu)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {totalHalaman > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Halaman {halaman} dari {totalHalaman} ({PER_HALAMAN} baris per halaman)</span>
          <span className="flex gap-4">
            {halaman > 1 && <Link href={hrefHal(halaman - 1)} className="hover:underline">← Sebelumnya</Link>}
            {halaman < totalHalaman && <Link href={hrefHal(halaman + 1)} className="hover:underline">Berikutnya →</Link>}
          </span>
        </div>
      )}

      <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-5">
        <p className="text-sm font-medium text-slate-900 mb-3">+ Tambah Rekening &amp; Pagu Baru</p>
        <form action={addRekening} className="grid sm:grid-cols-6 gap-3 items-end">
          <TambahRekeningFields
            subKegiatan={(subKegiatan ?? []) as any}
            katalog={(katalogBelanja ?? []) as any}
          />
          <div className="sm:col-span-1">
            <label className="text-xs font-medium text-slate-600 mb-1 block">Sumber Dana</label>
            <input
              name="sumber_dana"
              list="daftar-sumber-dana"
              required
              placeholder="PAD"
              autoComplete="off"
              className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600 mb-1 block">PPTK</label>
            <select
              name="pptk_id"
              defaultValue=""
              className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
            >
              <option value="">-- pilih PPTK --</option>
              {(pptkList ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Pagu Anggaran ({tahapanLabel(tahapan)})
            </label>
            <input
              type="number"
              name="pagu_anggaran"
              required
              placeholder="0"
              className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
            />
          </div>
          <div className="sm:col-span-1">
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-medium rounded-lg px-3 py-2"
            >
              + Tambah
            </button>
          </div>
        </form>
        <p className="text-xs text-slate-400 mt-3">
          Kalau kode rekening + sumber dana + sub kegiatan sudah ada (mis. dari tahapan lain), pagu untuk
          tahapan {tahapanLabel(tahapan)} akan otomatis melekat ke rekening yang sama -- tidak dobel.
        </p>
      </div>

      <details className="bg-white rounded-xl border border-slate-200 p-5 group">
        <summary className="text-sm font-medium text-slate-900 cursor-pointer select-none">
          Sub Kegiatan yang dibutuhkan belum ada di daftar? Tambahkan dulu di sini
        </summary>

        <div className="mt-4 space-y-5">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
              1. Tambah Sub Kegiatan Baru (di bawah Kegiatan yang sudah ada)
            </p>
            <form action={addSubKegiatan} className="grid sm:grid-cols-5 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Kegiatan</label>
                <select
                  name="kegiatan_id"
                  required
                  defaultValue=""
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
                >
                  <option value="" disabled>Pilih kegiatan</option>
                  {(kegiatan ?? []).map((k: any) => (
                    <option key={k.id} value={k.id}>{k.kode_kegiatan} -- {k.nama_kegiatan}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Kode Sub Kegiatan</label>
                <input
                  name="kode_sub_kegiatan"
                  required
                  placeholder="4.01.xx.x.xx.xxxx"
                  className="w-full text-sm font-mono border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Nama Sub Kegiatan</label>
                <input
                  name="nama_sub_kegiatan"
                  required
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
                />
              </div>
              <button
                type="submit"
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-medium rounded-lg px-3 py-2"
              >
                + Tambah Sub Kegiatan
              </button>
            </form>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
              2. Kegiatannya juga belum ada? Tambah Kegiatan Baru dulu (di bawah Program yang sudah ada)
            </p>
            <form action={addKegiatan} className="grid sm:grid-cols-5 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Program</label>
                <select
                  name="program_id"
                  required
                  defaultValue=""
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
                >
                  <option value="" disabled>Pilih program</option>
                  {(program ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.kode_program} -- {p.nama_program}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Kode Kegiatan</label>
                <input
                  name="kode_kegiatan"
                  required
                  placeholder="4.01.xx.2.xx"
                  className="w-full text-sm font-mono border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Nama Kegiatan</label>
                <input
                  name="nama_kegiatan"
                  required
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
                />
              </div>
              <button
                type="submit"
                className="bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg px-3 py-2"
              >
                + Tambah Kegiatan
              </button>
            </form>
            <p className="text-xs text-slate-400 mt-2">
              Program baru di luar daftar yang ada belum bisa ditambah lewat form (jarang berubah) --
              hubungi tim developer kalau ini benar-benar dibutuhkan.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
