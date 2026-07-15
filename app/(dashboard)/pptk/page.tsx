import { createClient } from "@/lib/supabase/server";
import { upsertPptk } from "./actions";

const TAHUN_SEKARANG = new Date().getFullYear();

export default async function PptkPage() {
  const supabase = createClient();

  const { data: subKegiatan } = await supabase
    .from("sub_kegiatan")
    .select("id, kode_sub_kegiatan, nama_sub_kegiatan")
    .eq("tahun_anggaran", TAHUN_SEKARANG)
    .order("kode_sub_kegiatan");

  const { data: pptkList } = await supabase
    .from("pptk")
    .select("*")
    .eq("tahun_anggaran", TAHUN_SEKARANG);

  const pptkBySubKeg = new Map<string, any>((pptkList ?? []).map((p: any) => [p.sub_kegiatan_id, p]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-xl text-slate-900">PPTK per Sub Kegiatan</h1>
        <p className="text-sm text-slate-500">
          Nama &amp; NIP PPTK Tahun Anggaran {TAHUN_SEKARANG}. Klik simpan untuk memperbarui.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {(subKegiatan ?? []).map((sk: any) => {
          const existing = pptkBySubKeg.get(sk.id);
          return (
            <form key={sk.id} action={upsertPptk} className="p-4 grid sm:grid-cols-12 gap-3 items-end">
              <input type="hidden" name="sub_kegiatan_id" value={sk.id} />
              <input type="hidden" name="tahun_anggaran" value={TAHUN_SEKARANG} />
              <div className="sm:col-span-4">
                <p className="text-xs text-slate-400 font-mono">{sk.kode_sub_kegiatan}</p>
                <p className="text-sm text-slate-700">{sk.nama_sub_kegiatan}</p>
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Nama PPTK</label>
                <input
                  name="nama"
                  defaultValue={existing?.nama}
                  required
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 block">NIP</label>
                <input
                  name="nip"
                  defaultValue={existing?.nip === "TBD" ? "" : existing?.nip}
                  required
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Nomor SK</label>
                <input
                  name="nomor_sk"
                  defaultValue={existing?.nomor_sk === "TBD" ? "" : existing?.nomor_sk}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <div className="sm:col-span-1">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg px-2 py-2"
                >
                  Simpan
                </button>
              </div>
            </form>
          );
        })}
      </div>
    </div>
  );
}
