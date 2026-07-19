import { createClient } from "@/lib/supabase/server";
import { getPeriode } from "@/lib/periode";
import { addPejabat, updatePejabat, deletePejabat } from "./actions";
import { ShieldCheck, Trash2, AlertTriangle } from "lucide-react";

const JABATAN_LABEL: Record<string, string> = {
  KPA: "Kuasa Pengguna Anggaran (KPA)",
  PPTK: "Pejabat Pelaksana Teknis Kegiatan (PPTK)",
  BENDAHARA_PENGELUARAN_PEMBANTU: "Bendahara Pengeluaran Pembantu (BPP)",
};

export default async function PejabatPage() {
  const { tahun } = getPeriode();
  const supabase = createClient();

  const { data: pejabat } = await supabase
    .from("pejabat_skpd")
    .select("id, jabatan, nama, nip, pangkat, nomor_sk, judul_sk, tanggal_sk")
    .eq("tahun_anggaran", tahun)
    .order("jabatan")
    .order("nama");

  const groups: Record<string, any[]> = { KPA: [], PPTK: [], BENDAHARA_PENGELUARAN_PEMBANTU: [] };
  (pejabat ?? []).forEach((p: any) => groups[p.jabatan]?.push(p));

  const pptkBelumLengkap = groups.PPTK.filter((p) => !p.nip);

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="font-serif text-xl text-slate-900">Manajemen Akun (KPA/PPTK/BPP)</h1>
        <p className="text-sm text-slate-500">
          Data pejabat untuk Tahun Anggaran {tahun} -- dipakai otomatis mengisi Nota Dinas, SPP/SPTJB,
          dan Kwitansi GU. Menu ini bisa diubah sewaktu-waktu kalau ada promosi/mutasi jabatan.
          Khusus <span className="font-medium">nama PPTK</span>: sudah otomatis tersinkron (dicocokkan
          berdasarkan nama) dengan data PPTK di menu <span className="font-medium">Rekening &amp; Pagu
          (DPA)</span> yang diimpor dari file lampiran Anda -- lengkapi NIP dan Pangkat/Gol di bawah untuk
          nama-nama yang sudah muncul.
        </p>
      </div>

      {pptkBelumLengkap.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2.5 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            {pptkBelumLengkap.length} PPTK dari hasil impor Rekening &amp; Pagu belum ada NIP-nya --{" "}
            {pptkBelumLengkap.map((p) => p.nama).join(", ")}. Lengkapi lewat form edit di bawah.
          </p>
        </div>
      )}

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
              <form key={row.id} action={updatePejabat} className="p-4 grid sm:grid-cols-12 gap-3 items-end">
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
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Pangkat/Gol</label>
                  <input
                    name="pangkat"
                    defaultValue={row.pangkat ?? ""}
                    placeholder="mis. Penata Tk. I (III/d)"
                    className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Judul SK</label>
                  <input
                    name="judul_sk"
                    defaultValue={row.judul_sk ?? ""}
                    placeholder={`mis. Penunjukan ${JABATAN_LABEL[jabatan].split(" (")[0]}`}
                    className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Nomor SK</label>
                  <input
                    name="nomor_sk"
                    defaultValue={row.nomor_sk ?? ""}
                    className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Tanggal SK</label>
                  <input
                    type="date"
                    name="tanggal_sk"
                    defaultValue={row.tanggal_sk ?? ""}
                    className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg px-2 py-2"
                  >
                    Simpan
                  </button>
                </div>
                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    formAction={deletePejabat}
                    className="w-full flex items-center justify-center gap-1 text-rose-500 hover:text-rose-700 text-xs border border-rose-200 rounded-lg px-2 py-2"
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
                placeholder="Nama pegawai"
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
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Pangkat/Gol</label>
              <input
                name="pangkat"
                placeholder="mis. Penata Tk. I (III/d)"
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
              />
            </div>
            <div className="sm:col-span-5">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Judul SK</label>
              <input
                name="judul_sk"
                placeholder={`mis. Penunjukan ${JABATAN_LABEL[jabatan].split(" (")[0]}`}
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Nomor SK</label>
              <input
                name="nomor_sk"
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Tanggal SK</label>
              <input
                type="date"
                name="tanggal_sk"
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
              />
            </div>
            <div className="sm:col-span-3">
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xs font-medium rounded-lg px-2 py-2"
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
