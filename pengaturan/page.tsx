import { createClient } from "@/lib/supabase/server";
import { updatePengaturan } from "./actions";
import { Settings, Info } from "lucide-react";

export default async function PengaturanPage() {
  const supabase = createClient();
  const { data: pengaturan } = await supabase
    .from("pengaturan_aplikasi")
    .select("nama_skpd_baris1, nama_skpd_baris2")
    .eq("id", 1)
    .maybeSingle();

  const baris1 = pengaturan?.nama_skpd_baris1 || "Bagian Perekonomian dan Sumber Daya Alam";
  const baris2 = pengaturan?.nama_skpd_baris2 || "Sekretariat Daerah Kota Batu";

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-slate-400" />
        <div>
          <h1 className="font-serif text-xl text-slate-900">Pengaturan Aplikasi</h1>
          <p className="text-sm text-slate-500">
            Pengaturan umum yang dipakai di seluruh dokumen cetak (Nota Dinas, SPP/SPTJB, Kwitansi GU).
          </p>
        </div>
      </div>

      <div className="bg-sky-50 border border-sky-200 rounded-lg px-4 py-3 flex items-start gap-2.5 text-sm text-sky-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          Ini adalah SATU sumber data nama SKPD untuk ketiga dokumen sekaligus -- ubah di sini, otomatis
          berlaku di Nota Dinas, SPP/SPTJB, dan Kwitansi GU tanpa perlu ubah kode atau environment
          variable lagi.
        </p>
      </div>

      <form action={updatePengaturan} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Nama SKPD -- Baris 1</label>
          <input
            name="nama_skpd_baris1"
            defaultValue={baris1}
            required
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Nama SKPD -- Baris 2</label>
          <input
            name="nama_skpd_baris2"
            defaultValue={baris2}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
          />
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-600 space-y-2">
          <p className="font-medium text-slate-700">Pratinjau tampilan:</p>
          <p>
            <span className="text-slate-400">Di Nota Dinas &amp; SPP (1 baris):</span><br />
            {baris1} {baris2}
          </p>
          <p>
            <span className="text-slate-400">Di Kwitansi (2 baris rata kiri):</span><br />
            {baris1}<br />
            {baris2}
          </p>
        </div>

        <button
          type="submit"
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2"
        >
          Simpan Pengaturan
        </button>
      </form>
    </div>
  );
}
