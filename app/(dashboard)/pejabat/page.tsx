import { createClient } from "@/lib/supabase/server";
import { getPeriode } from "@/lib/periode";
import { addPejabat, updatePejabat, deletePejabat } from "./actions";
import { ShieldCheck, Trash2 } from "lucide-react";

const JABATAN_LABEL: Record<string, string> = {
  KPA: "Kuasa Pengguna Anggaran (KPA)",
  PPTK: "Pejabat Pelaksana Teknis Kegiatan (PPTK)",
  BENDAHARA_PENGELUARAN_PEMBANTU: "Bendahara Pengeluaran Pembantu (BPP)",
};

export default async function PejabatPage() {
  const { tahun } = getPeriode();
  const supabase = createClient();

  const [{ data: pejabat }, { data: subKegiatan }] = await Promise.all([
    supabase
      .from("pejabat_skpd")
      .select("*, sub_kegiatan:sub_kegiatan_id(kode_sub_kegiatan, nama_sub_kegiatan)")
      .eq("tahun_anggaran", tahun)
      .order("jabatan"),
    supabase
      .from("sub_kegiatan")
      .select("id, kode_sub_kegiatan, nama_sub_kegiatan")
      .eq("tahun_anggaran", tahun)
      .order("kode_sub_kegiatan"),
  ]);

  const groups: Record<string, any[]> = { KPA: [], PPTK: [], BENDAHARA_PENGELUARAN_PEMBANTU: [] };
  (pejabat ?? []).forEach((p: any) => groups[p.jabatan]?.push(p));

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="font-serif text-xl text-slate-900">Pejabat SKPD</h1>
        <p className="text-sm text-slate-500">
          Data KPA, PPTK, dan Bendahara Pengeluaran Pembantu untuk Tahun Anggaran {tahun}.
          Dipakai otomatis mengisi Nota Dinas, SPP/SPTJB, dan Kwitansi GU.
        </p>
      </div>

      {(Object.keys(JABATAN_LABEL) as Array<keyof typeof JABATAN_LABEL>).map((jabatan) => (
        <div key={jabatan} className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-medium text-slate-900">{JABATAN_LABEL[jabatan]}</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {groups[jabatan].length === 0 && (
              <p className="px-5 py-4 text-sm text-slate-400">Belum ada data.</p>
            )}
            {groups[jabatan].map((row: any) => (
              <form
                key={row.id}
                action={updatePejabat}
                className="p-4 grid sm:grid-cols-12 gap-3 items-end"
              >
                <input type="hidden" name="id" value={row.id} />
                <div className="sm:col-span-3">
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Nama</label>
                  <input
                    name="nama"
                    defaultValue={row.nama}
                    required
                    className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-600 mb-1 block">NIP</label>
                  <input
                    name="nip"
                    defaultValue={row.nip}
                    required
                    className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                {jabatan === "PPTK" && (
                  <div className="sm:col-span-3">
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Sub Kegiatan</label>
                    <select
                      name="sub_kegiatan_id"
                      defaultValue={row.sub_kegiatan_id ?? ""}
                      required
                      className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
                    >
                      <option value="" disabled>Pilih sub kegiatan</option>
                      {(subKegiatan ?? []).map((sk: any) => (
                        <option key={sk.id} value={sk.id}>{sk.nama_sub_kegiatan}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Nomor SK</label>
                  <input
                    name="nomor_sk"
                    defaultValue={row.nomor_sk ?? ""}
                    className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div className={jabatan === "PPTK" ? "sm:col-span-1" : "sm:col-span-3"}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Tanggal SK</label>
                  <input
                    type="date"
                    name="tanggal_sk"
                    defaultValue={row.tanggal_sk ?? ""}
                    className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div className="sm:col-span-1 flex gap-1.5">
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg px-2 py-2"
                  >
                    Simpan
                  </button>
                </div>
                <div className="sm:col-span-12 flex justify-end -mt-2">
                  <button
                    type="submit"
                    formAction={deletePejabat}
                    className="text-rose-500 hover:text-rose-700 text-xs flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Hapus
                  </button>
                </div>
              </form>
            ))}
          </div>

          <form
            action={addPejabat}
            className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-4 grid sm:grid-cols-12 gap-3 items-end"
          >
            <input type="hidden" name="jabatan" value={jabatan} />
            <input type="hidden" name="tahun_anggaran" value={tahun} />
            <div className="sm:col-span-3">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Nama</label>
              <input
                name="nama"
                required
                placeholder="Nama pejabat"
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">NIP</label>
              <input
                name="nip"
                required
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
              />
            </div>
            {jabatan === "PPTK" && (
              <div className="sm:col-span-3">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Sub Kegiatan</label>
                <select
                  name="sub_kegiatan_id"
                  required
                  defaultValue=""
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
                >
                  <option value="" disabled>Pilih sub kegiatan</option>
                  {(subKegiatan ?? []).map((sk: any) => (
                    <option key={sk.id} value={sk.id}>{sk.nama_sub_kegiatan}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Nomor SK</label>
              <input
                name="nomor_sk"
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
              />
            </div>
            <div className={jabatan === "PPTK" ? "sm:col-span-1" : "sm:col-span-3"}>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Tanggal SK</label>
              <input
                type="date"
                name="tanggal_sk"
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
              />
            </div>
            <div className="sm:col-span-1">
              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg px-2 py-2"
              >
                + Tambah
              </button>
            </div>
          </form>
        </div>
      ))}
    </div>
  );
}
