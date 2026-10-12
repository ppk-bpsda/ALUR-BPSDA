"use client";

import Link from "next/link";

export default function GenerateButtons({
  pengajuanId,
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
      {/* Kuitansi/Bukti Pembayaran dibutuhkan untuk LS maupun GU -- bedanya
          cuma siapa yang tanda tangan "Penerima" (penyedia untuk LS, atau
          penerima GU), potongan pajaknya sudah otomatis sesuai data yang
          sama dipakai untuk kedua metode. */}
      <Link
        href={`/dokumen/${pengajuanId}/kwitansi_gu`}
        target="_blank"
        className="text-xs bg-slate-100 hover:bg-slate-200 rounded-md px-2 py-1"
      >
        Kuitansi
      </Link>
    </div>
  );
}
