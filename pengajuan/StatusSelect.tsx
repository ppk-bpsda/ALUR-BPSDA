"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "diajukan", label: "Diajukan" },
  { value: "disetujui", label: "Disetujui" },
  { value: "dicairkan", label: "Dicairkan" },
  { value: "ditolak", label: "Ditolak" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  diajukan: "bg-amber-50 text-amber-700",
  disetujui: "bg-emerald-50 text-emerald-700",
  dicairkan: "bg-sky-50 text-sky-700",
  ditolak: "bg-rose-50 text-rose-700",
};

// Dropdown ubah status pengajuan -- PENTING: hitungan "Realisasi Sblm" &
// "Sisa" di Nota Dinas HANYA menghitung pengajuan berstatus
// disetujui/dicairkan (lihat lib/dokumenData.ts). Selama status masih
// "draft", pengajuan itu TIDAK ikut menambah Realisasi Sblm pengajuan
// berikutnya untuk rekening yang sama -- jadi begitu pencairan sudah
// final, ubah statusnya di sini supaya rantai Pagu/Realisasi/Sisa pada
// Nota Dinas berikutnya benar.
export default function StatusSelect({ pengajuanId, status }: { pengajuanId: string; status: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [saving, setSaving] = useState(false);

  async function handleChange(newStatus: string) {
    if (newStatus === current) return;
    const prev = current;
    setCurrent(newStatus);
    setSaving(true);
    const res = await fetch(`/api/pengajuan/${pengajuanId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Gagal mengubah status.");
      setCurrent(prev);
      return;
    }
    router.refresh();
  }

  return (
    <select
      value={current}
      disabled={saving}
      onChange={(e) => handleChange(e.target.value)}
      className={`text-[11px] font-medium rounded-full px-2 py-0.5 border-0 cursor-pointer disabled:opacity-50 ${
        STATUS_COLORS[current] || "bg-slate-100 text-slate-600"
      }`}
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
