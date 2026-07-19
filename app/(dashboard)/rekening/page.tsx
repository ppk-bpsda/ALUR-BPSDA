import { createClient } from "@/lib/supabase/server";
import { getPeriode, tahapanLabel, TAHAPAN_OPTIONS } from "@/lib/periode";
import { addRekening, updateRekening, deleteRekening, addKegiatan, addSubKegiatan, salinDariTahapan } from "./actions";
import { formatRupiah } from "@/lib/terbilang";
import { Trash2, Copy } from "lucide-react";

export default async function RekeningPage() {
  const { tahun, tahapan } = getPeriode();
  const supabase = createClient();

  const [{ data: dpaList }, { data: subKegiatan }, { data: pptkList }, { data: program }, { data: kegiatan }] =
    await Promise.all([
      supabase
        .from("dpa")
        .select(
          "id, pagu_anggaran, pptk_id, rekening:rekening_belanja(id, kode_rekening, jenis_belanja, kelompok_belanja, sumber_dana, sub_kegiatan_id, sub_kegiatan:sub_kegiatan(kode_sub_kegiatan, nama_sub_kegiatan))"
        )
        .eq("tahun_anggaran", tahun)
        .eq("tahapan", tahapan)
        .order("id"),
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
    ]);

  const totalPagu = (dpaList ?? []).reduce((s, r: any) => s + Number(r.pagu_anggaran || 0), 0);
  const tahapanLain = TAHAPAN_OPTIONS.filter((t) => t.value !== tahapan);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-xl text-slate-900">Rekening &amp; Pagu (DPA)</h1>
        <p className="text-sm text-slate-500">
          Tahun Anggaran {tahun}, Tahapan {tahapanLabel(tahapan)}. Tambah/edit/hapus rekening dan pagu
          untuk tahapan ini -- ganti periode lewat menu akun di kanan atas untuk mengelola tahapan lain.
        </p>
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
            {(dpaList ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-400 text-sm">
                  Belum ada rekening di tahapan ini. Tambahkan lewat form di bawah.
                </td>
              </tr>
            )}
            {(dpaList ?? []).map((row: any) => (
              <tr key={row.id} className="border-b border-slate-50 last:border-0 align-top">
                <form action={updateRekening} className="contents">
                  <input type="hidden" name="dpa_id" value={row.id} />
                  <input type="hidden" name="rekening_id" value={row.rekening?.id} />
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
                    <input
                      name="kelompok_belanja"
                      list="kelompok-belanja-opsi"
                      defaultValue={row.rekening?.kelompok_belanja ?? ""}
                      placeholder="Belanja Operasi"
                      className="w-32 text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      name="sumber_dana"
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

      <datalist id="kelompok-belanja-opsi">
        <option value="Belanja Operasi" />
        <option value="Belanja Modal" />
        <option value="Belanja Tidak Terduga" />
        <option value="Belanja Transfer" />
      </datalist>

      <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-5">
        <p className="text-sm font-medium text-slate-900 mb-3">+ Tambah Rekening &amp; Pagu Baru</p>
        <form action={addRekening} className="grid sm:grid-cols-6 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600 mb-1 block">Sub Kegiatan</label>
            <select
              name="sub_kegiatan_id"
              required
              defaultValue=""
              className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
            >
              <option value="" disabled>Pilih sub kegiatan</option>
              {(subKegiatan ?? []).map((sk: any) => (
                <option key={sk.id} value={sk.id}>
                  {sk.kode_sub_kegiatan} -- {sk.nama_sub_kegiatan}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600 mb-1 block">Kode Rekening</label>
            <input
              name="kode_rekening"
              required
              placeholder="mis. 5.1.02.01.001.00024"
              className="w-full text-sm font-mono border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600 mb-1 block">Uraian Belanja</label>
            <input
              name="jenis_belanja"
              required
              placeholder="mis. Belanja Alat Tulis Kantor"
              className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="text-xs font-medium text-slate-600 mb-1 block">Kelompok</label>
            <input
              name="kelompok_belanja"
              list="kelompok-belanja-opsi"
              placeholder="Belanja Operasi"
              className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="text-xs font-medium text-slate-600 mb-1 block">Sumber Dana</label>
            <input
              name="sumber_dana"
              required
              placeholder="PAD"
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
