import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/terbilang";
import { getPeriode, tahapanLabel } from "@/lib/periode";
import { Wallet, Receipt, FileSpreadsheet, ClipboardList } from "lucide-react";

const statusStyle: Record<string, string> = {
  disetujui: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  diajukan: "bg-amber-50 text-amber-700 ring-amber-200",
  dicairkan: "bg-sky-50 text-sky-700 ring-sky-200",
  draft: "bg-slate-100 text-slate-600 ring-slate-200",
  ditolak: "bg-rose-50 text-rose-700 ring-rose-200",
};

export default async function DashboardPage() {
  const { tahun, tahapan } = getPeriode();
  const supabase = createClient();

  const { data: rekap } = await supabase
    .from("rekap_realisasi")
    .select("*")
    .eq("tahun_anggaran", tahun)
    .eq("tahapan", tahapan);
  const totalPagu = (rekap ?? []).reduce((s, r: any) => s + Number(r.pagu_anggaran || 0), 0);
  const totalRealisasi = (rekap ?? []).reduce((s, r: any) => s + Number(r.total_realisasi || 0), 0);
  const totalSisa = totalPagu - totalRealisasi;

  const { data: pengajuanTerbaru } = await supabase
    .from("pengajuan_belanja")
    .select("id, nomor_bukti, uraian_kegiatan, jumlah_pengajuan, status, created_at, dpa:dpa!inner(tahun_anggaran, tahapan)")
    .eq("dpa.tahun_anggaran", tahun)
    .eq("dpa.tahapan", tahapan)
    .order("created_at", { ascending: false })
    .limit(8);

  const bulanIni = new Date();
  const { count: pengajuanBulanIni } = await supabase
    .from("pengajuan_belanja")
    .select("id, dpa:dpa!inner(tahun_anggaran, tahapan)", { count: "exact", head: true })
    .eq("dpa.tahun_anggaran", tahun)
    .eq("dpa.tahapan", tahapan)
    .gte("created_at", new Date(bulanIni.getFullYear(), bulanIni.getMonth(), 1).toISOString());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-xl text-slate-900">Selamat datang kembali, Admin</h1>
        <p className="text-sm text-slate-500">
          Ringkasan anggaran &amp; pengajuan -- Tahun Anggaran {tahun}, Tahapan {tahapanLabel(tahapan)}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Pagu" value={`Rp ${formatRupiah(totalPagu)}`} icon={Wallet} />
        <StatCard
          label="Total Realisasi"
          value={`Rp ${formatRupiah(totalRealisasi)}`}
          delta={totalPagu ? `${((totalRealisasi / totalPagu) * 100).toFixed(1)}% dari pagu` : "-"}
          icon={Receipt}
        />
        <StatCard label="Sisa Anggaran" value={`Rp ${formatRupiah(totalSisa)}`} icon={FileSpreadsheet} />
        <StatCard label="Pengajuan Bulan Ini" value={String(pengajuanBulanIni ?? 0)} icon={ClipboardList} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-5 pb-3">
          <p className="text-sm font-medium text-slate-900">Pengajuan Terbaru</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="font-medium px-5 py-2.5">Nomor Bukti</th>
              <th className="font-medium px-5 py-2.5">Uraian</th>
              <th className="font-medium px-5 py-2.5">Jumlah</th>
              <th className="font-medium px-5 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {(pengajuanTerbaru ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-slate-400 text-sm">
                  Belum ada pengajuan. Mulai dari menu "Pengajuan Belanja".
                </td>
              </tr>
            )}
            {(pengajuanTerbaru ?? []).map((row: any) => (
              <tr key={row.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 text-slate-500 font-mono text-xs">{row.nomor_bukti || "-"}</td>
                <td className="px-5 py-3 text-slate-700 max-w-md truncate">{row.uraian_kegiatan}</td>
                <td className="px-5 py-3 text-slate-700">Rp {formatRupiah(row.jumlah_pengajuan)}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${
                      statusStyle[row.status] ?? statusStyle.draft
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label, value, delta, icon: Icon,
}: {
  label: string; value: string; delta?: string; icon: any;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs text-slate-500">{label}</p>
        <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
          <Icon className="h-4 w-4 text-slate-900" strokeWidth={1.75} />
        </div>
      </div>
      <p className="mt-3 font-serif text-2xl text-slate-900">{value}</p>
      {delta && <p className="mt-2 text-xs font-medium text-emerald-600">{delta}</p>}
    </div>
  );
}
