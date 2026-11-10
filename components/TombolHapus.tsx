"use client";

import { Trash2 } from "lucide-react";

/** Tombol Hapus dengan konfirmasi (mencegah terhapus karena salah klik). */
export default function TombolHapus({
  action, dpaId, rekeningId, ringkas, kembali, label = "Hapus", kelas = "",
}: {
  action: (fd: FormData) => void | Promise<void>;
  dpaId: string; rekeningId: string; ringkas: string; kembali?: string; label?: string; kelas?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Hapus belanja ini dari tahapan aktif?\n\n${ringkas}\n\nNilai sebelumnya tetap tersimpan di Riwayat.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="dpa_id" value={dpaId} />
      <input type="hidden" name="rekening_id" value={rekeningId} />
      {kembali && <input type="hidden" name="kembali" value={kembali} />}
      <button type="submit" className={`inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 hover:underline ${kelas}`}>
        <Trash2 className="h-3.5 w-3.5" /> {label}
      </button>
    </form>
  );
}
