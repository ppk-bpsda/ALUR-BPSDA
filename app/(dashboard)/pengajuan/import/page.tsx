"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Upload, ArrowLeft, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type PreviewRow = {
  row: number;
  id_sementara: string;
  kode_rekening: string;
  breadcrumb: string | null;
  uraian_kegiatan: string;
  jumlah_pengajuan: number;
  jumlah_item_rincian: number;
  penyedia_baru: string | null;
  ok: boolean;
  errors: string[];
};

type CommitRow = { row: number; id_sementara: string; ok: boolean; message: string };

export default function ImportPengajuanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ summary: any; results: PreviewRow[] } | null>(null);
  const [commitResult, setCommitResult] = useState<{ summary: any; commitResults: CommitRow[] } | null>(null);
  const [error, setError] = useState("");

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError("");
    setCommitResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "preview");
      const res = await fetch("/api/pengajuan/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses file");
      setPreview(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "commit");
      const res = await fetch("/api/pengajuan/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal import");
      setCommitResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/pengajuan" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-serif text-xl text-slate-900">Import Pengajuan Belanja</h1>
          <p className="text-sm text-slate-500">
            Import banyak pengajuan sekaligus dari file Excel -- cocok untuk data yang sudah disusun manual (Nota
            Dinas/SPP/Kuitansi lama) supaya tidak perlu entri satu-satu.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-800">1. Download template Excel</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Isi sheet Pengajuan, Rincian, dan (opsional) Potongan sesuai petunjuk di sheet pertama.
            </p>
          </div>
          <a
            href="/api/pengajuan/import/template"
            className="flex items-center gap-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg px-4 py-2 whitespace-nowrap"
          >
            <Download className="h-4 w-4" /> Download Template
          </a>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-800 mb-1.5">2. Upload file yang sudah diisi</p>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setPreview(null);
              setCommitResult(null);
              setError("");
            }}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
          />
        </div>

        {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handlePreview}
            disabled={!file || loading}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            {loading && !preview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Cek / Preview
          </button>
          {preview && preview.summary.valid > 0 && !commitResult && (
            <button
              onClick={handleCommit}
              disabled={loading}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Import {preview.summary.valid} Baris yang Valid
            </button>
          )}
        </div>
      </div>

      {preview && !commitResult && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex gap-4 text-sm">
            <p className="text-slate-600">
              Total baris: <span className="font-medium">{preview.summary.total}</span>
            </p>
            <p className="text-emerald-700">
              Valid: <span className="font-medium">{preview.summary.valid}</span>
            </p>
            <p className="text-rose-600">
              Error: <span className="font-medium">{preview.summary.error}</span>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="font-medium px-3 py-2">Baris</th>
                  <th className="font-medium px-3 py-2">ID Sementara</th>
                  <th className="font-medium px-3 py-2">Rekening</th>
                  <th className="font-medium px-3 py-2">Uraian</th>
                  <th className="font-medium px-3 py-2">Jumlah</th>
                  <th className="font-medium px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.results.map((r) => (
                  <tr key={r.row} className="border-b border-slate-50 align-top">
                    <td className="px-3 py-2 text-slate-500">{r.row}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.id_sementara}</td>
                    <td className="px-3 py-2">
                      <p>{r.kode_rekening}</p>
                      {r.breadcrumb && <p className="text-[11px] text-slate-400">{r.breadcrumb}</p>}
                    </td>
                    <td className="px-3 py-2 max-w-[220px]">{r.uraian_kegiatan}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      Rp {Number(r.jumlah_pengajuan || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2">
                      {r.ok ? (
                        <span className="flex items-center gap-1 text-emerald-700 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Siap diimport
                          {r.penyedia_baru && (
                            <span className="text-slate-400"> (penyedia baru: {r.penyedia_baru})</span>
                          )}
                        </span>
                      ) : (
                        <span className="flex items-start gap-1 text-rose-600 text-xs">
                          <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>{r.errors.join("; ")}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {commitResult && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex gap-4 text-sm">
            <p className="text-emerald-700">
              Berhasil diimport: <span className="font-medium">{commitResult.summary.diimport}</span>
            </p>
            <p className="text-rose-600">
              Gagal: <span className="font-medium">{commitResult.summary.gagalImport}</span>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="font-medium px-3 py-2">Baris</th>
                  <th className="font-medium px-3 py-2">ID Sementara</th>
                  <th className="font-medium px-3 py-2">Hasil</th>
                </tr>
              </thead>
              <tbody>
                {commitResult.commitResults.map((r) => (
                  <tr key={r.row} className="border-b border-slate-50">
                    <td className="px-3 py-2 text-slate-500">{r.row}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.id_sementara}</td>
                    <td className="px-3 py-2">
                      {r.ok ? (
                        <span className="flex items-center gap-1 text-emerald-700 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {r.message}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-rose-600 text-xs">
                          <XCircle className="h-3.5 w-3.5" /> {r.message}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link
            href="/pengajuan"
            className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            Lihat Daftar Pengajuan
          </Link>
        </div>
      )}
    </div>
  );
}
