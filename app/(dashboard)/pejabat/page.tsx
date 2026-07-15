import { createClient } from "@/lib/supabase/server";
import { upsertPejabat } from "./actions";
import { ShieldCheck } from "lucide-react";

const TAHUN_SEKARANG = new Date().getFullYear();

export default async function PejabatPage() {
  const supabase = createClient();
  const { data: pejabat } = await supabase
    .from("pejabat_skpd")
    .select("*")
    .eq("tahun_anggaran", TAHUN_SEKARANG)
    .order("jabatan");

  const kpa = pejabat?.find((p: any) => p.jabatan === "KPA");
  const bpp = pejabat?.find((p: any) => p.jabatan === "BENDAHARA_PENGELUARAN_PEMBANTU");

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-serif text-xl text-slate-900">Pejabat SKPD</h1>
        <p className="text-sm text-slate-500">
          Data KPA &amp; Bendahara Pengeluaran Pembantu untuk Tahun Anggaran {TAHUN_SEKARANG}.
          Dipakai otomatis mengisi Nota Dinas, SPP/SPTJB, dan Kwitansi GU.
        </p>
      </div>

      <PejabatCard
        title="Kuasa Pengguna Anggaran (KPA)"
        jabatan="KPA"
        tahun={TAHUN_SEKARANG}
        nama={kpa?.nama}
        nip={kpa?.nip}
      />
      <PejabatCard
        title="Bendahara Pengeluaran Pembantu (BPP)"
        jabatan="BENDAHARA_PENGELUARAN_PEMBANTU"
        tahun={TAHUN_SEKARANG}
        nama={bpp?.nama}
        nip={bpp?.nip}
      />
    </div>
  );
}

function PejabatCard({
  title, jabatan, tahun, nama, nip,
}: {
  title: string; jabatan: string; tahun: number; nama?: string; nip?: string;
}) {
  return (
    <form action={upsertPejabat} className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        <p className="text-sm font-medium text-slate-900">{title}</p>
      </div>
      <input type="hidden" name="jabatan" value={jabatan} />
      <input type="hidden" name="tahun_anggaran" value={tahun} />
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Nama</label>
          <input
            name="nama"
            defaultValue={nama}
            required
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">NIP</label>
          <input
            name="nip"
            defaultValue={nip}
            required
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
          />
        </div>
      </div>
      <button
        type="submit"
        className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2"
      >
        Simpan
      </button>
    </form>
  );
}
