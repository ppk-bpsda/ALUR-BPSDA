"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, History } from "lucide-react";
import Link from "next/link";

type Status = "baru" | "ubah" | "sama" | "koreksi" | "lewati" | "galat";
type Baris = {
  baris: number; status: Status;
  kode_sub_kegiatan: string; kode_rekening: string; sumber_dana: string; jenis_belanja: string;
  pagu_lama: number | null; pagu_baru: number; selisih: number; realisasi: number;
  perluKonfirmasi: boolean; rincianKoreksi: string[]; saran: string[];
  peringatan: string[]; galat: string[];
};
type Ringkasan = {
  total: number; baru: number; ubah: number; sama: number; koreksi: number; lewati: number; galat: number;
  subBaru: number; selisih: number; perluKonfirmasi: number; tidakDiBerkas: number;
};

const rp = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
const WARNA: Record<Status, string> = {
  baru: "bg-emerald-50 text-emerald-700", ubah: "bg-amber-50 text-amber-700", sama: "bg-slate-100 text-slate-500",
  koreksi: "bg-violet-50 text-violet-700", lewati: "bg-slate-50 text-slate-400", galat: "bg-rose-50 text-rose-700",
};

export default function RekeningImport({ periode, tahun, tahapan }: { periode: string; tahun: number; tahapan: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"" | "periksa" | "simpan">("");
  const [error, setError] = useState<string | null>(null);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [rencana, setRencana] = useState<Baris[]>([]);
  const [sukses, setSukses] = useState<string | null>(null);
  const [tampilSama, setTampilSama] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState(false);

  function reset() { setRingkasan(null); setRencana([]); setSukses(null); setError(null); setKonfirmasi(false); }

  async function kirim(mode: "pratinjau" | "simpan") {
    if (!file) { setError("Pilih berkas terlebih dahulu."); return; }
    setError(null); setSukses(null); setBusy(mode === "simpan" ? "simpan" : "periksa");
    try {
      const fd = new FormData();
      fd.set("file", file);
      // periode yang dilihat di layar -- server menolak bila periode aktif sudah berbeda
      fd.set("periode", `${tahun}|${tahapan}`);
      if (konfirmasi) fd.set("konfirmasi", "1");
      const res = await fetch(`/api/rekening/import?mode=${mode}`, { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { if (j.ringkasan) setRingkasan(j.ringkasan); throw new Error(j.error || "Gagal memproses berkas."); }
      if (mode === "pratinjau") { setRingkasan(j.ringkasan); setRencana(j.rencana); setKonfirmasi(false); }
      else {
        const h = j.hasil;
        setSukses(
          `Tersimpan: ${h.tambah} pagu ditambahkan, ${h.ubah} diperbarui, ${h.koreksi} koreksi master, ` +
          `${h.rekeningBaru} rekening baru, ${h.subBaru} sub kegiatan baru. Semua tercatat di Riwayat Pagu.`
        );
        setRingkasan(null); setRencana([]); setFile(null); setKonfirmasi(false);
        if (ref.current) ref.current.value = "";
        router.refresh();
      }
    } catch (e: any) { setError(e?.message || "Gagal memproses berkas."); }
    finally { setBusy(""); }
  }

  const perluCentang = (ringkasan?.perluKonfirmasi ?? 0) > 0;
  const bisaSimpan = !!ringkasan && ringkasan.galat === 0 && ringkasan.baru + ringkasan.ubah + ringkasan.koreksi > 0 && (!perluCentang || konfirmasi);
  const tampil = rencana
    .filter((r) => tampilSama || (r.status !== "sama" && r.status !== "lewati"))
    // galat di atas, lalu yang perlu diperiksa
    .sort((a, b) => Number(b.status === "galat") - Number(a.status === "galat") || Number(b.perluKonfirmasi) - Number(a.perluKonfirmasi) || a.baris - b.baris);

  return (
    <div className="space-y-4">
      <div className="card p-5 flex flex-wrap items-center gap-3">
        <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); reset(); }} />
        <button type="button" className="btn-secondary" onClick={() => ref.current?.click()}>
          <FileSpreadsheet className="h-4 w-4" /> {file ? file.name : "Pilih berkas Excel / CSV"}
        </button>
        <button type="button" className="btn-primary" disabled={!file || !!busy} onClick={() => kirim("pratinjau")}>
          {busy === "periksa" ? <><Loader2 className="h-4 w-4 animate-spin" /> Memeriksa…</> : "Periksa (pratinjau)"}
        </button>
        <button type="button" className="btn-primary" disabled={!bisaSimpan || !!busy} onClick={() => kirim("simpan")}>
          {busy === "simpan" ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan…</> : `Simpan ke ${periode}`}
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
      {sukses && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> <span className="flex-1">{sukses}</span>
          <Link href="/rekening/riwayat" className="underline inline-flex items-center gap-1"><History className="h-3.5 w-3.5" /> Lihat riwayat</Link>
        </p>
      )}

      {ringkasan && (
        <div className="card p-5 space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="chip bg-emerald-50 text-emerald-700 ring-emerald-200">{ringkasan.baru} baru</span>
            <span className="chip bg-amber-50 text-amber-700 ring-amber-200">{ringkasan.ubah} diubah</span>
            <span className="chip bg-violet-50 text-violet-700 ring-violet-200">{ringkasan.koreksi} koreksi kode/uraian</span>
            <span className="chip bg-slate-100 text-slate-600 ring-slate-200">{ringkasan.sama} sama</span>
            <span className="chip bg-slate-50 text-slate-500 ring-slate-200">{ringkasan.lewati} dilewati (pagu kosong)</span>
            <span className="chip bg-rose-50 text-rose-700 ring-rose-200">{ringkasan.galat} galat</span>
            <span className="chip bg-sky-50 text-sky-700 ring-sky-200">{ringkasan.subBaru} sub kegiatan baru</span>
            <span className="text-slate-600 ml-1">Selisih pagu total: <b className={ringkasan.selisih < 0 ? "text-rose-700" : "text-slate-900"}>Rp {rp(ringkasan.selisih)}</b></span>
          </div>

          {ringkasan.galat > 0 && (
            <p className="text-sm text-rose-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Perbaiki baris galat di berkas lalu periksa ulang — penyimpanan dikunci selama masih ada galat.</p>
          )}
          {ringkasan.tidakDiBerkas > 0 && (
            <p className="text-xs text-slate-500">
              Info: {ringkasan.tidakDiBerkas} rekening yang punya pagu di {periode} tidak ada di berkas ini. Rekening tersebut <b>tidak diubah dan tidak dihapus</b>.
            </p>
          )}
          {perluCentang && ringkasan.galat === 0 && (
            <label className="flex items-start gap-2 text-sm text-violet-900 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-[#237469]" checked={konfirmasi} onChange={(e) => setKonfirmasi(e.target.checked)} />
              <span>Saya sudah memeriksa <b>{ringkasan.perluKonfirmasi} baris bertanda ⚠</b> (rekening baru di luar katalog, sumber dana baru untuk kode yang sudah ada, atau koreksi kode/uraian) dan yakin sudah benar.</span>
            </label>
          )}

          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" className="accent-[#237469]" checked={tampilSama} onChange={(e) => setTampilSama(e.target.checked)} /> Tampilkan baris yang tidak berubah / dilewati
          </label>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs min-w-[900px]">
              <thead><tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="px-3 py-2 font-medium">Baris</th><th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Kode Rekening</th><th className="px-3 py-2 font-medium">Sumber Dana</th>
                <th className="px-3 py-2 font-medium text-right">Pagu lama</th><th className="px-3 py-2 font-medium text-right">Pagu baru</th>
                <th className="px-3 py-2 font-medium text-right">Selisih</th><th className="px-3 py-2 font-medium">Catatan</th>
              </tr></thead>
              <tbody>
                {tampil.slice(0, 500).map((r) => (
                  <tr key={r.baris} className="border-b border-slate-50 align-top">
                    <td className="px-3 py-2 text-slate-400">{r.baris}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 ${WARNA[r.status]}`}>{r.status}</span>
                      {r.perluKonfirmasi && r.status !== "galat" && <span title="Perlu diperiksa" className="ml-1 text-violet-600">⚠</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600 break-all">{r.kode_rekening || "-"}</td>
                    <td className="px-3 py-2 text-slate-500">{r.sumber_dana}</td>
                    <td className="px-3 py-2 text-right">{r.pagu_lama === null ? "—" : rp(r.pagu_lama)}</td>
                    <td className="px-3 py-2 text-right">{rp(r.pagu_baru)}</td>
                    <td className={`px-3 py-2 text-right ${r.selisih < 0 ? "text-rose-600" : ""}`}>{rp(r.selisih)}</td>
                    <td className="px-3 py-2">
                      {r.galat.map((g, i) => <p key={i} className="text-rose-700">{g}</p>)}
                      {r.rincianKoreksi.map((g, i) => <p key={`k${i}`} className="text-violet-700 font-mono">{g}</p>)}
                      {r.peringatan.map((g, i) => <p key={i} className="text-amber-700">{g}</p>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tampil.length > 500 && <p className="text-xs text-slate-500">Menampilkan 500 baris pertama dari {tampil.length} (galat & yang perlu diperiksa diurutkan paling atas). Semua baris tetap diproses saat disimpan.</p>}
        </div>
      )}
    </div>
  );
}
