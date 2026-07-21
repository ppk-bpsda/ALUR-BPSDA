"use client";

import Link from "next/link";

export default function GenerateButtons({
  pengajuanId,
  metodePembayaran = "GU",
}: {
  pengajuanId: string;
  metodePembayaran?: "LS" | "GU";
}) {
  return (
    <div className="flex gap-1.5">
      <Link
        href={`/dokumen/${pengajuanId}/nota_dinas`}
        target="_blank"
        className="text-xs bg-slate-100 hover:bg-slate-200 rounded-md px-2 py-1"
      >
        Nota Dinas
      </Link>
      <Link
        href={`/dokumen/${pengajuanId}/spp_sptjb`}
        target="_blank"
        className="text-xs bg-slate-100 hover:bg-slate-200 rounded-md px-2 py-1"
      >
        SPP
      </Link>
      {/* Kwitansi GU cuma relevan untuk pencairan GU -- LS dibayar langsung
          ke rekening penyedia, tidak lewat kwitansi penerima seperti GU. */}
      {metodePembayaran !== "LS" && (
        <Link
          href={`/dokumen/${pengajuanId}/kwitansi_gu`}
          target="_blank"
          className="text-xs bg-slate-100 hover:bg-slate-200 rounded-md px-2 py-1"
        >
          Kwitansi
        </Link>
      )}
    </div>
  );
}
