"use client";

import { useState } from "react";
import { updatePenyedia, deletePenyedia } from "./actions";
import { Pencil, Trash2, X } from "lucide-react";

export default function PenyediaRow({ row }: { row: any }) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <tr className="border-b border-slate-50 last:border-0">
        <td className="px-5 py-3 text-slate-700">{row.nama_penyedia}</td>
        <td className="px-5 py-3 text-slate-500 text-xs">
          {row.bentuk_usaha === "perseorangan" ? "Perseorangan" : "Badan Usaha"}
        </td>
        <td className="px-5 py-3 text-slate-500">{row.npwp || "--"}</td>
        <td className="px-5 py-3 text-slate-500">
          {row.status_pkp ? (
            <span className="text-xs bg-sky-50 text-sky-700 rounded-full px-2 py-0.5">PKP</span>
          ) : (
            <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">Non-PKP</span>
          )}
        </td>
        <td className="px-5 py-3 text-slate-500">
          {row.pph_final_umkm ? (
            <span className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5">Ya</span>
          ) : (
            <span className="text-xs text-slate-400">--</span>
          )}
        </td>
        <td className="px-5 py-3">
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setEditing(true)}
              className="text-slate-400 hover:text-emerald-600"
              title="Edit data penyedia ini"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <form action={deletePenyedia}>
              <input type="hidden" name="id" value={row.id} />
              <button type="submit" className="text-rose-500 hover:text-rose-700" title="Hapus">
                <Trash2 className="h-4 w-4" />
              </button>
            </form>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100 bg-slate-50/70 align-top">
      <td colSpan={6} className="px-5 py-4">
        <form
          action={async (formData) => {
            await updatePenyedia(formData);
            setEditing(false);
          }}
          className="grid sm:grid-cols-2 gap-4"
        >
          <input type="hidden" name="id" value={row.id} />
          <EditField name="nama_penyedia" label="Nama Penyedia" defaultValue={row.nama_penyedia} required />
          <EditField name="nama_direktur" label="Nama Direktur / Penanggung Jawab" defaultValue={row.nama_direktur} />
          <EditField name="alamat" label="Alamat" defaultValue={row.alamat} className="sm:col-span-2" />
          <EditField name="npwp" label="NPWP" defaultValue={row.npwp} />
          <EditField name="rekening_bank" label="Rekening Bank" defaultValue={row.rekening_bank} />

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Bentuk Penyedia</label>
            <select
              name="bentuk_usaha"
              defaultValue={row.bentuk_usaha || "badan_usaha"}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 bg-white"
            >
              <option value="badan_usaha">Badan Usaha (PT/CV/Koperasi/dst)</option>
              <option value="perseorangan">Perseorangan</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="status_pkp"
              id={`status_pkp_${row.id}`}
              defaultChecked={row.status_pkp}
              className="h-4 w-4"
            />
            <label htmlFor={`status_pkp_${row.id}`} className="text-sm text-slate-600">
              Berstatus <span className="font-medium">PKP</span>
            </label>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              name="pph_final_umkm"
              id={`pph_final_umkm_${row.id}`}
              defaultChecked={row.pph_final_umkm}
              className="h-4 w-4"
            />
            <label htmlFor={`pph_final_umkm_${row.id}`} className="text-sm text-slate-600">
              Sudah punya Surat Keterangan PPh Final UMKM (PP 23/2018)
            </label>
          </div>

          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2"
            >
              Simpan Perubahan
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-3 py-2"
            >
              <X className="h-4 w-4" /> Batal
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function EditField({
  name, label, required, className, defaultValue,
}: {
  name: string; label: string; required?: boolean; className?: string; defaultValue?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-slate-600 mb-1.5 block">{label}</label>
      <input
        name={name}
        required={required}
        defaultValue={defaultValue || ""}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 bg-white"
      />
    </div>
  );
}
