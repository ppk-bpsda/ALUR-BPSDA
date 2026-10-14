"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

export default function HapusPerjadinButton({ id, redirectTo }: { id: string; redirectTo?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function hapus() {
    if (!confirm("Hapus data perjalanan dinas ini beserta berkas yang diunggah? Tindakan ini tidak dapat dibatalkan.")) return;
    setBusy(true);
    const res = await fetch(`/api/perjalanan-dinas/${id}`, { method: "DELETE" });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || "Gagal menghapus."); setBusy(false); return; }
    if (redirectTo) router.push(redirectTo); else router.refresh();
  }
  return (
    <button type="button" onClick={hapus} disabled={busy} className="btn-danger !py-1.5" title="Hapus">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
