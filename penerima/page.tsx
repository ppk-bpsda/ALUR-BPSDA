import { createClient } from "@/lib/supabase/server";
import { addPenerima, deletePenerima } from "./actions";
import { Trash2 } from "lucide-react";

export default async function PenerimaPage() {
  const supabase = createClient();
  const { data: list } = await supabase.from("penerima").select("*").order("nama_penerima");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-xl text-slate-900">Penerima</h1>
        <p className="text-sm text-slate-500">
          Database nama penerima uang GU untuk fitur cari &amp; pilih di Kwitansi.
        </p>
      </div>

      <form action={addPenerima} className="bg-white rounded-xl border border-slate-200 p-5 grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Nama Penerima</label>
          <input
            name="nama_penerima"
            required
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Keterangan (opsional)</label>
          <input
            name="keterangan"
            placeholder="mis. Staf Bagian Perekonomian dan SDA"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            + Tambah Penerima
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="font-medium px-5 py-2.5">Nama Penerima</th>
              <th className="font-medium px-5 py-2.5">Keterangan</th>
              <th className="font-medium px-5 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {(list ?? []).map((row: any) => (
              <tr key={row.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 text-slate-700">{row.nama_penerima}</td>
                <td className="px-5 py-3 text-slate-500">{row.keterangan}</td>
                <td className="px-5 py-3 text-right">
                  <form action={deletePenerima}>
                    <input type="hidden" name="id" value={row.id} />
                    <button type="submit" className="text-rose-500 hover:text-rose-700">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
