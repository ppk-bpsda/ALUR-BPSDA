"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";

type Kegiatan = { id: string; nama_kegiatan: string };
type SubKegiatan = { id: string; nama_sub_kegiatan: string; kegiatan_id: string };
type Rekening = { id: string; jenis_belanja: string; sub_kegiatan_id: string };

export default function PengajuanFilter({
  kegiatanList,
  subKegiatanList,
  rekeningList,
}: {
  kegiatanList: Kegiatan[];
  subKegiatanList: SubKegiatan[];
  rekeningList: Rekening[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [kegiatan, setKegiatan] = useState(searchParams.get("kegiatan") || "");
  const [subKegiatan, setSubKegiatan] = useState(searchParams.get("sub_kegiatan") || "");
  const [rekening, setRekening] = useState(searchParams.get("rekening") || "");
  const [dari, setDari] = useState(searchParams.get("dari") || "");
  const [sampai, setSampai] = useState(searchParams.get("sampai") || "");

  // Opsi bertingkat: Sub Kegiatan mengikuti Kegiatan yang dipilih,
  // Belanja mengikuti Sub Kegiatan yang dipilih.
  const subKegiatanOptions = kegiatan
    ? subKegiatanList.filter((s) => s.kegiatan_id === kegiatan)
    : subKegiatanList;
  const rekeningOptions = subKegiatan
    ? rekeningList.filter((r) => r.sub_kegiatan_id === subKegiatan)
    : kegiatan
    ? rekeningList.filter((r) => subKegiatanOptions.some((s) => s.id === r.sub_kegiatan_id))
    : rekeningList;

  function terapkan(next: {
    kegiatan?: string;
    subKegiatan?: string;
    rekening?: string;
    dari?: string;
    sampai?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const status = params.get("status");
    params.delete("kegiatan");
    params.delete("sub_kegiatan");
    params.delete("rekening");
    params.delete("dari");
    params.delete("sampai");
    if (status) params.set("status", status);

    const k = next.kegiatan ?? kegiatan;
    const sk = next.subKegiatan ?? subKegiatan;
    const rk = next.rekening ?? rekening;
    const d = next.dari ?? dari;
    const s = next.sampai ?? sampai;

    if (k) params.set("kegiatan", k);
    if (sk) params.set("sub_kegiatan", sk);
    if (rk) params.set("rekening", rk);
    if (d) params.set("dari", d);
    if (s) params.set("sampai", s);

    router.push(`/pengajuan?${params.toString()}`);
  }

  function handleKegiatan(v: string) {
    setKegiatan(v);
    setSubKegiatan("");
    setRekening("");
    terapkan({ kegiatan: v, subKegiatan: "", rekening: "" });
  }

  function handleSubKegiatan(v: string) {
    setSubKegiatan(v);
    setRekening("");
    terapkan({ subKegiatan: v, rekening: "" });
  }

  function handleRekening(v: string) {
    setRekening(v);
    terapkan({ rekening: v });
  }

  const adaFilter = kegiatan || subKegiatan || rekening || dari || sampai;

  function reset() {
    setKegiatan("");
    setSubKegiatan("");
    setRekening("");
    setDari("");
    setSampai("");
    terapkan({ kegiatan: "", subKegiatan: "", rekening: "", dari: "", sampai: "" });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-end gap-3">
      <div className="min-w-[180px]">
        <label className="block text-xs text-slate-400 mb-1">Kegiatan</label>
        <select
          value={kegiatan}
          onChange={(e) => handleKegiatan(e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
        >
          <option value="">Semua Kegiatan</option>
          {kegiatanList.map((k) => (
            <option key={k.id} value={k.id}>{k.nama_kegiatan}</option>
          ))}
        </select>
      </div>

      <div className="min-w-[200px]">
        <label className="block text-xs text-slate-400 mb-1">Sub Kegiatan</label>
        <select
          value={subKegiatan}
          onChange={(e) => handleSubKegiatan(e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
        >
          <option value="">Semua Sub Kegiatan</option>
          {subKegiatanOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.nama_sub_kegiatan}</option>
          ))}
        </select>
      </div>

      <div className="min-w-[200px]">
        <label className="block text-xs text-slate-400 mb-1">Belanja</label>
        <select
          value={rekening}
          onChange={(e) => handleRekening(e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
        >
          <option value="">Semua Belanja</option>
          {rekeningOptions.map((r) => (
            <option key={r.id} value={r.id}>{r.jenis_belanja}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Dari Tanggal</label>
        <input
          type="date"
          value={dari}
          onChange={(e) => setDari(e.target.value)}
          onBlur={() => terapkan({})}
          className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
        />
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Sampai Tanggal</label>
        <input
          type="date"
          value={sampai}
          onChange={(e) => setSampai(e.target.value)}
          onBlur={() => terapkan({})}
          className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
        />
      </div>

      <button
        type="button"
        onClick={() => terapkan({})}
        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg px-3 py-1.5"
      >
        <Search className="h-3.5 w-3.5" /> Cari
      </button>

      {adaFilter && (
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm px-2 py-1.5"
        >
          <X className="h-3.5 w-3.5" /> Reset
        </button>
      )}
    </div>
  );
}
