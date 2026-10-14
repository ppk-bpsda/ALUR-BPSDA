"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2 } from "lucide-react";

export default function ImportExcel({ jenis, tahun, label }: { jenis: "pegawai" | "sbu"; tahun?: number; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; lewati?: string[] } | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const q = new URLSearchParams({ jenis });
      if (tahun) q.set("tahun", String(tahun));
      const res = await fetch(`/api/perjalanan-dinas/import?${q}`, { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Impor gagal.");
      setMsg({ ok: true, text: `${j.jumlah} baris berhasil diimpor/diperbarui.`, lewati: j.lewati });
      router.refresh();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Impor gagal." });
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div>
      <input ref={ref} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} {label}
      </button>
      {msg && (
        <div className={`mt-2 text-xs rounded-lg px-3 py-2 border ${msg.ok ? "text-emerald-800 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"}`}>
          {msg.text}
          {msg.lewati && msg.lewati.length > 0 && <ul className="mt-1 list-disc pl-4 text-amber-700">{msg.lewati.slice(0, 5).map((l, i) => <li key={i}>{l}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
