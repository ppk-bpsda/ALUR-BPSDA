import { createClient } from "@/lib/supabase/server";
import { updateDpa } from "./actions";
import { formatRupiah } from "@/lib/terbilang";

const TAHUN_SEKARANG = new Date().getFullYear();

export default async function RekeningPage() {
  const supabase = createClient();

  const { data: dpaList } = await supabase
    .from("dpa")
    .select(
      "id, pagu_anggaran, tahapan, rekening:rekening_belanja(kode_rekening, jenis_belanja, sumber_dana, sub_kegiatan:sub_kegiatan(nama_sub_kegiatan))"
    )
    .eq("tahun_anggaran", TAHUN_SEKARANG)
    .order("id");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-xl text-slate-900">Rekening &amp; Pagu (DPA)</h1>
        <p className="text-sm text-slate-500">
          Tahun Anggaran {TAHUN_SEKARANG}. Ubah pagu atau tahapan DPA lalu klik simpan pada baris terkait.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="font-medium px-4 py-2.5">Kode Rekening</th>
              <th className="font-medium px-4 py-2.5">Belanja</th>
              <th className="font-medium px-4 py-2.5">Sumber Dana</th>
              <th className="font-medium px-4 py-2.5">Tahapan DPA</th>
              <th className="font-medium px-4 py-2.5">Pagu Anggaran</th>
              <th className="font-medium px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {(dpaList ?? []).map((row: any) => (
              <tr key={row.id} className="border-b border-slate-50 last:border-0">
                <form action={updateDpa} className="contents">
                  <input type="hidden" name="id" value={row.id} />
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{row.rekening?.kode_rekening}</td>
                  <td className="px-4 py-2.5 text-slate-700">{row.rekening?.jenis_belanja}</td>
                  <td className="px-4 py-2.5 text-slate-500">{row.rekening?.sumber_dana}</td>
                  <td className="px-4 py-2.5">
                    <select
                      name="tahapan"
                      defaultValue={row.tahapan}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none"
                    >
                      <option value="murni">Murni</option>
                      <option value="pergeseran">Pergeseran</option>
                      <option value="perubahan">Perubahan</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      name="pagu_anggaran"
                      defaultValue={row.pagu_anggaran}
                      className="w-32 text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="submit"
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-1.5"
                    >
                      Simpan
                    </button>
                  </td>
                </form>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Total {dpaList?.length ?? 0} rekening. Pagu ditampilkan dalam Rupiah utuh (contoh:{" "}
        {formatRupiah(1234567)} = Rp 1.234.567).
      </p>
    </div>
  );
}
