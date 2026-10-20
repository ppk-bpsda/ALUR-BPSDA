"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Tampilan galat yang ramah. TIDAK menampilkan error.message (bisa memuat detail internal);
 * hanya kode `digest` yang aman dibagikan ke administrator untuk dicari di log server.
 */
export default function ErrorPanel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div role="alert" className="card w-full max-w-md animate-scale-in p-8 text-center shadow-card">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-50 text-warning-600 ring-1 ring-warning-200">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="text-heading text-ink-900">Terjadi kendala</h2>
        <p className="mt-2 text-body text-slate-600">
          Halaman belum bisa ditampilkan. Penyebab umum: koneksi ke database terputus atau project Supabase sedang
          dijeda. Coba muat ulang; bila berulang, hubungi administrator sistem.
        </p>
        {error.digest && (
          <p className="mt-3 text-caption text-slate-500">
            Kode kendala: <span className="font-mono text-slate-700">{error.digest}</span>
          </p>
        )}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button variant="primary" leftIcon={<RotateCw className="h-4 w-4" />} onClick={() => reset()}>
            Coba lagi
          </Button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="btn btn-secondary">
            Ke Dashboard
          </a>
        </div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/login" className="mt-4 inline-block text-caption text-slate-500 underline-offset-2 hover:text-brand-700 hover:underline">
          Masuk ulang
        </a>
      </div>
    </div>
  );
}
