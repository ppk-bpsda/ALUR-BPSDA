"use client";

import Link from "next/link";
import { Printer, ArrowLeft, FileDown } from "lucide-react";

export default function PrintToolbar({
  pengajuanId,
  jenis,
  judul,
}: {
  pengajuanId: string;
  jenis: string;
  judul: string;
}) {
  return (
    <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Link href="/pengajuan" className="text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <p className="text-sm font-medium text-slate-900">{judul}</p>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={`/api/generate-dokumen?pengajuan_id=${pengajuanId}&jenis=${jenis}`}
          className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg px-3 py-2"
        >
          <FileDown className="h-3.5 w-3.5" /> Unduh Word (.docx)
        </a>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg px-3 py-2"
        >
          <Printer className="h-3.5 w-3.5" /> Cetak
        </button>
      </div>
    </div>
  );
}
