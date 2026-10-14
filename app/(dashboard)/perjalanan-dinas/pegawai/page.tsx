import { Pencil, Trash2, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ImportExcel from "@/components/ImportExcel";
import { addPegawai, updatePegawai, deletePegawai } from "./actions";

export const metadata = { title: "Data Pegawai" };

function Fields({ p }: { p?: any }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div><label className="field-label">Nama (beserta gelar)</label><input name="nama" required defaultValue={p?.nama} className="field" /></div>
      <div><label className="field-label">NIP</label><input name="nip" required defaultValue={p?.nip} className="field" inputMode="numeric" /></div>
      <div><label className="field-label">Pangkat / Golongan</label><input name="pangkat_gol" defaultValue={p?.pangkat_gol ?? ""} className="field" placeholder="mis. Penata Muda - III/a" /></div>
      <div><label className="field-label">Jabatan</label><input name="jabatan" defaultValue={p?.jabatan ?? ""} className="field" /></div>
    </div>
  );
}

export default async function PegawaiPage(props: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("perjadin_pegawai").select("*").order("urut", { nullsFirst: false }).order("nama");
  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Data Pegawai</h1>
          <p className="page-sub">Daftar pegawai pelaksana perjalanan dinas. Dibaca otomatis untuk mencocokkan nama/NIP pada Surat Tugas.</p>
        </div>
        <ImportExcel jenis="pegawai" label="Impor dari Excel" />
      </div>

      {sp.ok && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{sp.ok}</div>}
      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Tabel belum tersedia — jalankan migrasi 20260802000000.</div>}

      <details className="card group">
        <summary className="cursor-pointer list-none px-5 py-3.5 flex items-center gap-2 text-sm font-medium text-brand-700">
          <UserPlus className="h-4 w-4" /> Tambah pegawai
        </summary>
        <form action={addPegawai} className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
          <Fields />
          <button className="btn-primary">Simpan</button>
        </form>
      </details>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-slate-50/80 text-slate-500 text-left">
            <tr><th className="px-4 py-3 w-12 font-medium">No</th><th className="px-4 py-3 font-medium">Nama</th><th className="px-4 py-3 font-medium">NIP</th><th className="px-4 py-3 font-medium">Pangkat/Gol.</th><th className="px-4 py-3 font-medium">Jabatan</th><th className="px-4 py-3 w-24" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((p: any, i: number) => (
              <tr key={p.id} className="hover:bg-slate-50/60 align-top">
                <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{p.nama}</td>
                <td className="px-4 py-3 tabular-nums text-slate-600">{p.nip}</td>
                <td className="px-4 py-3 text-slate-600">{p.pangkat_gol || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{p.jabatan || "-"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 justify-end">
                    <details className="relative">
                      <summary className="btn-secondary !py-1.5 cursor-pointer list-none" title="Ubah"><Pencil className="h-4 w-4" /></summary>
                      <form action={updatePegawai} className="absolute right-0 z-10 mt-2 w-[min(34rem,85vw)] card shadow-lift p-4 space-y-3">
                        <input type="hidden" name="id" value={p.id} />
                        <Fields p={p} />
                        <button className="btn-primary">Simpan perubahan</button>
                      </form>
                    </details>
                    <form action={deletePegawai}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="btn-danger !py-1.5" title="Hapus"><Trash2 className="h-4 w-4" /></button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Belum ada pegawai. Tambahkan atau impor dari Excel (kolom: No, Nama, NIP, Pangkat/Gol, Jabatan).</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
