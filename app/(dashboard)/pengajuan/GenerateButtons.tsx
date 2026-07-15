"use client";

export default function GenerateButtons({ pengajuanId }: { pengajuanId: string }) {
  function generate(jenis: "nota_dinas" | "spp_sptjb" | "kwitansi_gu") {
    window.open(`/api/generate-dokumen?pengajuan_id=${pengajuanId}&jenis=${jenis}`, "_blank");
  }
  return (
    <div className="flex gap-1.5">
      <button onClick={() => generate("nota_dinas")} className="text-xs bg-slate-100 hover:bg-slate-200 rounded-md px-2 py-1">
        Nota Dinas
      </button>
      <button onClick={() => generate("spp_sptjb")} className="text-xs bg-slate-100 hover:bg-slate-200 rounded-md px-2 py-1">
        SPP
      </button>
      <button onClick={() => generate("kwitansi_gu")} className="text-xs bg-slate-100 hover:bg-slate-200 rounded-md px-2 py-1">
        Kwitansi
      </button>
    </div>
  );
}
