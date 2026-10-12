"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-center">
        <h2 className="font-serif text-lg text-slate-900 mb-2">Terjadi kendala</h2>
        <p className="text-sm text-slate-600 mb-4">
          Halaman tidak dapat ditampilkan. Penyebab umum: koneksi ke database terputus atau project Supabase sedang
          dijeda. Coba muat ulang; bila berulang, hubungi administrator sistem.
        </p>
        {error.digest && <p className="text-xs text-slate-400 mb-4 font-mono">Kode: {error.digest}</p>}
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => reset()}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Coba lagi
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/login" className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            Ke halaman login
          </a>
        </div>
      </div>
    </div>
  );
}
