import { createClient } from "@/lib/supabase/server";
import { addPenyedia } from "./actions";
import PenyediaRow from "./PenyediaRow";

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
        <Field name="nama_direktur" label="Nama Direktur / Penanggung Jawab" />
        <Field name="alamat" label="Alamat" className="sm:col-span-2" />
        <Field name="npwp" label="NPWP" />
        <Field name="rekening_bank" label="Rekening Bank" />
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Bentuk Penyedia</label>
          <select
            name="bentuk_usaha"
            defaultValue="badan_usaha"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 bg-white"
          >
            <option value="badan_usaha">Badan Usaha (PT/CV/Koperasi/dst)</option>
            <option value="perseorangan">Perseorangan</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" name="status_pkp" id="status_pkp" className="h-4 w-4" />
          <label htmlFor="status_pkp" className="text-sm text-slate-600">
            Penyedia berstatus <span className="font-medium">PKP</span> (Pengusaha Kena Pajak) --
            boleh menerbitkan Faktur Pajak
          </label>
        </div>
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

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="font-medium px-5 py-2.5">Nama Penyedia</th>
              <th className="font-medium px-5 py-2.5">Bentuk</th>
              <th className="font-medium px-5 py-2.5">NPWP</th>
              <th className="font-medium px-5 py-2.5">PKP</th>
              <th className="font-medium px-5 py-2.5">PPh Final UMKM</th>
              <th className="font-medium px-5 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {(list ?? []).map((row: any) => (
              <PenyediaRow key={row.id} row={row} />
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
