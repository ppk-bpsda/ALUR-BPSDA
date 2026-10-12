"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

export default function RowActions({ pengajuanId }: { pengajuanId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Hapus pengajuan ini? Data rincian & potongan ikut terhapus, dan tidak bisa dikembalikan.")) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/pengajuan/${pengajuanId}`, { method: "DELETE" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "Gagal menghapus pengajuan.");
        return;
      }
      router.refresh();
    } catch {
      alert("Tidak dapat menghubungi server. Periksa koneksi internet lalu coba lagi.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex gap-1.5">
      <Link
        href={`/pengajuan/${pengajuanId}/edit`}
        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md px-2 py-1 flex items-center gap-1"
      >
        <Pencil className="h-3 w-3" /> Edit
      </Link>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="text-xs bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-600 rounded-md px-2 py-1 flex items-center gap-1"
      >
        <Trash2 className="h-3 w-3" /> {deleting ? "..." : "Hapus"}
      </button>
    </div>
  );
}
