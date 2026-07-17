import { createClient } from "@/lib/supabase/server";
import { addPenyedia, deletePenyedia } from "./actions";
import { Trash2 } from "lucide-react";

export default async function PenyediaPage() {
  const supabase = createClient();
  const { data: list } = await supabase.from("penyedia").select("*").order("nama_penyedia");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-xl text-slate-900">Penyedia Barang/Jasa</h1>
        <p className="text-sm text-slate-500">
          Database ini dipakai fitur cari &amp; pilih saat membuat Pengajuan Belanja --
          input sekali di sini, dipakai berkali-kali.
        </p>
      </div>

      <form action={addPenyedia} className="bg-white rounded-xl border border-slate-200 p-5 grid sm:grid-cols-2 gap-4">
        <Field name="nama_penyedia" label="Nama Penyedia" required />
        <Field name="nama_direktur" label="Nama Direktur" />
        <Field name="alamat" label="Alamat" className="sm:col-span-2" />
        <Field name="npwp" label="NPWP" />
        <Field name="rekening_bank" label="Rekening Bank" />
        <div className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" name="pph_final_umkm" id="pph_final_umkm" className="h-4 w-4" />
          <label htmlFor="pph_final_umkm" className="text-sm text-slate-600">
            Penyedia sudah punya Surat Keterangan PPh Final UMKM (PP 23/2018, tarif 0,5%) -- kalau
            dicentang, kalkulator pajak di Pengajuan Belanja otomatis pakai PPh Final, bukan PPh 22/23.
          </label>
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            + Tambah Penyedia
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="font-medium px-5 py-2.5">Nama Penyedia</th>
              <th className="font-medium px-5 py-2.5">Direktur</th>
              <th className="font-medium px-5 py-2.5">NPWP</th>
              <th className="font-medium px-5 py-2.5">Rekening Bank</th>
              <th className="font-medium px-5 py-2.5">PPh Final UMKM</th>
              <th className="font-medium px-5 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {(list ?? []).map((row: any) => (
              <tr key={row.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 text-slate-700">{row.nama_penyedia}</td>
                <td className="px-5 py-3 text-slate-500">{row.nama_direktur}</td>
                <td className="px-5 py-3 text-slate-500">{row.npwp}</td>
                <td className="px-5 py-3 text-slate-500">{row.rekening_bank}</td>
                <td className="px-5 py-3 text-slate-500">
                  {row.pph_final_umkm ? (
                    <span className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5">Ya</span>
                  ) : (
                    <span className="text-xs text-slate-400">--</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <form action={deletePenyedia}>
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

function Field({
  name, label, required, className,
}: {
  name: string; label: string; required?: boolean; className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-slate-600 mb-1.5 block">{label}</label>
      <input
        name={name}
        required={required}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
      />
    </div>
  );
}
