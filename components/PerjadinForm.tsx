"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud, Wand2, Loader2, FileText, X, Plus, Trash2, Search, AlertTriangle,
  CheckCircle2, Download, Sparkles, Info,
} from "lucide-react";
import type { PegawaiOpt, SbuOpt, DpaOpt } from "@/lib/perjadin/loaders";

export type PerjadinInitial = {
  id?: string;
  nomor_surat_tugas: string; tanggal_surat_tugas: string; maksud: string;
  tujuan_kota: string; tujuan_provinsi: string;
  tanggal_berangkat: string; tanggal_kembali: string;
  jenis_tarif: "perjalanan" | "rapat" | "diklat"; tarif_uang_harian: number;
  biaya_lain: { uraian: string; jumlah: number }[];
  dpa_id: string; tanggal_kuitansi: string; nomor_kuitansi: string;
  pegawai_ids: string[];
  surat_tugas_nama?: string | null; laporan_nama?: string | null;
};

const KOSONG: PerjadinInitial = {
  nomor_surat_tugas: "", tanggal_surat_tugas: "", maksud: "", tujuan_kota: "", tujuan_provinsi: "",
  tanggal_berangkat: "", tanggal_kembali: "", jenis_tarif: "perjalanan", tarif_uang_harian: 0,
  biaya_lain: [], dpa_id: "", tanggal_kuitansi: "", nomor_kuitansi: "", pegawai_ids: [],
};

const rp = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
const hari = (a: string, b: string) => {
  const x = Date.parse(a + "T00:00:00Z"), y = Date.parse(b + "T00:00:00Z");
  return isFinite(x) && isFinite(y) && y >= x ? Math.round((y - x) / 86400000) + 1 : 0;
};
const tarifDari = (s: SbuOpt | undefined, j: PerjadinInitial["jenis_tarif"]) =>
  !s ? 0 : j === "rapat" ? s.uang_harian_rapat : j === "diklat" ? s.uang_harian_diklat : s.uang_harian_perjalanan;

function Auto() {
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-1.5 py-px text-[10px] font-medium text-rose-600 ring-1 ring-inset ring-rose-100">
      <Sparkles className="h-2.5 w-2.5" /> otomatis
    </span>
  );
}

function Section({ no, title, desc, children }: { no: number; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-5">
        <span className="h-7 w-7 shrink-0 rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100 text-xs font-semibold flex items-center justify-center">{no}</span>
        <div>
          <h2 className="font-serif text-lg text-slate-900 leading-tight">{title}</h2>
          {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function FileBox({ label, file, setFile, tersimpan, wajib }: {
  label: string; file: File | null; setFile: (f: File | null) => void; tersimpan?: string | null; wajib?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div>
      <span className="field-label">{label}{wajib && <span className="text-rose-500"> *</span>}</span>
      <div
        onClick={() => ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors ${drag ? "border-brand-400 bg-brand-50" : "border-slate-200 hover:border-brand-300 hover:bg-slate-50/70"}`}
      >
        <input ref={ref} type="file" className="hidden" accept=".docx,.xlsx,.xls,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file ? (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-700">
            <FileText className="h-4 w-4 text-brand-600 shrink-0" />
            <span className="truncate max-w-[16rem]">{file.name}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); if (ref.current) ref.current.value = ""; }} className="text-slate-400 hover:text-rose-500" aria-label="Hapus berkas">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <UploadCloud className="h-6 w-6 mx-auto text-slate-400" strokeWidth={1.5} />
            <p className="text-sm text-slate-600 mt-1.5">Klik atau seret berkas ke sini</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Word (.docx), Excel (.xlsx/.xls), PDF · maks. 4 MB</p>
          </>
        )}
      </div>
      {tersimpan && !file && <p className="text-[11px] text-slate-500 mt-1.5">Tersimpan: {tersimpan} (unggah baru untuk mengganti)</p>}
    </div>
  );
}

export default function PerjadinForm(props: {
  tahun: number; pegawai: PegawaiOpt[]; sbu: SbuOpt[]; dpa: DpaOpt[]; initial?: PerjadinInitial;
}) {
  const { tahun, pegawai, sbu, dpa } = props;
  const router = useRouter();
  const edit = !!props.initial?.id;
  const [f, setF] = useState<PerjadinInitial>(props.initial ?? KOSONG);
  const [fileST, setFileST] = useState<File | null>(null);
  const [fileLap, setFileLap] = useState<File | null>(null);
  const [auto, setAuto] = useState<Set<string>>(new Set());
  const [tarifManual, setTarifManual] = useState(edit);
  const [catatan, setCatatan] = useState<string[]>([]);
  const [hasil, setHasil] = useState<unknown>(null);
  const [membaca, setMembaca] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sukses, setSukses] = useState<{ id: string; peringatan: string[] } | null>(null);
  const [cari, setCari] = useState("");
  const [semuaRek, setSemuaRek] = useState(false);

  const set = <K extends keyof PerjadinInitial>(k: K, v: PerjadinInitial[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setAuto((a) => { if (!a.has(k as string)) return a; const n = new Set(a); n.delete(k as string); return n; });
  };

  const sbuTerpilih = sbu.find((s) => s.tujuan === f.tujuan_provinsi);
  const lama = hari(f.tanggal_berangkat, f.tanggal_kembali);
  const biayaLainTotal = f.biaya_lain.reduce((s, b) => s + (Number(b.jumlah) || 0), 0);
  const totalOrang = f.tarif_uang_harian * lama + biayaLainTotal;
  const jmlPeserta = f.pegawai_ids.length;

  function pilihTujuan(prov: string, jenis = f.jenis_tarif, paksa = false) {
    const s = sbu.find((x) => x.tujuan === prov);
    setF((p) => ({
      ...p, tujuan_provinsi: prov, jenis_tarif: jenis,
      tarif_uang_harian: tarifManual && !paksa ? p.tarif_uang_harian : tarifDari(s, jenis),
    }));
  }

  async function bacaOtomatis() {
    if (!fileST) { setError("Unggah berkas Surat Tugas terlebih dahulu."); return; }
    setError(null); setMembaca(true);
    try {
      const fd = new FormData();
      fd.set("surat_tugas", fileST);
      if (fileLap) fd.set("laporan", fileLap);
      const res = await fetch("/api/perjalanan-dinas/ekstrak", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Gagal membaca berkas.");
      const h = j.hasil;
      const baru = new Set<string>();
      const next = { ...f };
      const isi = <K extends keyof PerjadinInitial>(k: K, v: PerjadinInitial[K] | undefined) => {
        if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return;
        next[k] = v as PerjadinInitial[K]; baru.add(k as string);
      };
      isi("nomor_surat_tugas", h.nomor_surat_tugas);
      isi("tanggal_surat_tugas", h.tanggal_surat_tugas);
      isi("maksud", h.maksud);
      isi("tujuan_kota", h.tujuan_kota);
      isi("tanggal_berangkat", h.tanggal_berangkat);
      isi("tanggal_kembali", h.tanggal_kembali);
      isi("pegawai_ids", h.peserta_ids);
      if (h.tujuan_provinsi && sbu.some((s) => s.tujuan === h.tujuan_provinsi)) {
        next.tujuan_provinsi = h.tujuan_provinsi; baru.add("tujuan_provinsi");
        next.tarif_uang_harian = tarifDari(sbu.find((s) => s.tujuan === h.tujuan_provinsi), next.jenis_tarif);
        baru.add("tarif_uang_harian"); setTarifManual(false);
      } else if (h.tujuan_provinsi) {
        h.catatan.push(`Tujuan "${h.tujuan_provinsi}" tidak ada pada tabel SBU — pilih manual.`);
      }
      if (!next.tanggal_kuitansi && next.tanggal_kembali) { next.tanggal_kuitansi = next.tanggal_kembali; baru.add("tanggal_kuitansi"); }
      setF(next); setAuto(baru); setCatatan(h.catatan ?? []); setHasil(h);
    } catch (e: any) {
      setError(e?.message || "Gagal membaca berkas.");
    } finally {
      setMembaca(false);
    }
  }

  async function simpan() {
    setError(null); setSukses(null);
    if (!f.maksud.trim()) return setError("Maksud/uraian perjalanan dinas wajib diisi.");
    if (!f.tanggal_berangkat || !f.tanggal_kembali) return setError("Tanggal berangkat dan kembali wajib diisi.");
    if (lama < 1) return setError("Tanggal kembali tidak boleh sebelum tanggal berangkat.");
    if (jmlPeserta === 0) return setError("Pilih minimal satu pegawai pelaksana.");
    if (!f.dpa_id) return setError("Pilih rekening/beban anggaran.");
    setMenyimpan(true);
    try {
      const fd = new FormData();
      fd.set("data", JSON.stringify({ ...f, tahun_anggaran: tahun, hasil_ekstraksi: hasil }));
      if (fileST) fd.set("surat_tugas", fileST);
      if (fileLap) fd.set("laporan", fileLap);
      const res = await fetch(edit ? `/api/perjalanan-dinas/${props.initial!.id}` : "/api/perjalanan-dinas", {
        method: edit ? "PUT" : "POST", body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Gagal menyimpan.");
      if (!edit) { router.push(`/perjalanan-dinas/${j.id}?tersimpan=1`); return; }
      setSukses({ id: j.id, peringatan: j.peringatan ?? [] });
      setFileST(null); setFileLap(null);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Gagal menyimpan.");
    } finally {
      setMenyimpan(false);
    }
  }

  const pegawaiTampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return pegawai.filter((p) => !q || p.nama.toLowerCase().includes(q) || p.nip.includes(q) || (p.jabatan ?? "").toLowerCase().includes(q));
  }, [pegawai, cari]);
  const dpaTampil = dpa.filter((d) => semuaRek || d.perjalanan || d.id === f.dpa_id);
  const dpaDipilih = dpa.find((d) => d.id === f.dpa_id);
  const A = (k: string) => auto.has(k) && <Auto />;

  return (
    <div className="space-y-5">
      {/* 1. Berkas */}
      <Section no={1} title="Unggah Berkas Sumber" desc="Surat Tugas dibaca otomatis untuk mengisi formulir di bawah. Hasil bacaan selalu dapat Anda koreksi.">
        <div className="grid sm:grid-cols-2 gap-4">
          <FileBox label="Surat Tugas" wajib file={fileST} setFile={setFileST} tersimpan={props.initial?.surat_tugas_nama} />
          <FileBox label="Laporan Perjalanan Dinas (opsional)" file={fileLap} setFile={setFileLap} tersimpan={props.initial?.laporan_nama} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={bacaOtomatis} disabled={membaca || !fileST} className="btn-primary">
            {membaca ? <><Loader2 className="h-4 w-4 animate-spin" /> Membaca berkas…</> : <><Wand2 className="h-4 w-4" /> Baca &amp; isi otomatis</>}
          </button>
          <p className="text-xs text-slate-500">Berkas hasil scan (gambar) tidak dapat dibaca — isi formulir secara manual.</p>
        </div>
        {catatan.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Mohon periksa:</p>
            <ul className="mt-1.5 list-disc pl-5 space-y-0.5 text-[13px]">{catatan.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
        )}
        {auto.size > 0 && (
          <p className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" /> Isian bertanda <Auto /> diambil dari berkas. Pada dokumen Kuitansi, data otomatis dicetak dengan <span className="text-red-600 font-medium">teks merah</span>.
          </p>
        )}
      </Section>

      {/* 2. Data surat */}
      <Section no={2} title="Data Surat Tugas &amp; Waktu Pelaksanaan">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Nomor Surat Tugas{A("nomor_surat_tugas")}</label>
            <input className="field" value={f.nomor_surat_tugas} onChange={(e) => set("nomor_surat_tugas", e.target.value)} placeholder="mis. 800.1.11.1/045/422.101/2026" />
          </div>
          <div>
            <label className="field-label">Tanggal Surat Tugas{A("tanggal_surat_tugas")}</label>
            <input type="date" className="field" value={f.tanggal_surat_tugas} onChange={(e) => set("tanggal_surat_tugas", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Maksud / Uraian Perjalanan Dinas <span className="text-rose-500">*</span>{A("maksud")}</label>
            <textarea rows={3} className="field" value={f.maksud} onChange={(e) => set("maksud", e.target.value)} placeholder="mis. menghadiri Rapat Koordinasi Pengelolaan Sumber Daya Air" />
          </div>
          <div>
            <label className="field-label">Tanggal Berangkat <span className="text-rose-500">*</span>{A("tanggal_berangkat")}</label>
            <input type="date" className="field" value={f.tanggal_berangkat} onChange={(e) => set("tanggal_berangkat", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Tanggal Kembali <span className="text-rose-500">*</span>{A("tanggal_kembali")}</label>
            <input type="date" className="field" min={f.tanggal_berangkat || undefined} value={f.tanggal_kembali} onChange={(e) => set("tanggal_kembali", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Tanggal Kuitansi{A("tanggal_kuitansi")}</label>
            <input type="date" className="field" value={f.tanggal_kuitansi} onChange={(e) => set("tanggal_kuitansi", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Nomor Kuitansi (opsional)</label>
            <input className="field" value={f.nomor_kuitansi} onChange={(e) => set("nomor_kuitansi", e.target.value)} />
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Lama perjalanan: <b className="text-slate-900">{lama > 0 ? `${lama} hari` : "—"}</b>
          <span className="text-xs text-slate-400"> (dihitung otomatis, hari berangkat &amp; kembali dihitung)</span>
        </p>
      </Section>

      {/* 3. Tujuan & tarif */}
      <Section no={3} title="Tujuan &amp; Tarif Uang Harian (SBU)" desc={`Tarif diambil dari tabel SBU Tahun Anggaran ${tahun}.`}>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Provinsi / Tujuan (SBU){A("tujuan_provinsi")}</label>
            <select className="field" value={f.tujuan_provinsi} onChange={(e) => { setTarifManual(false); pilihTujuan(e.target.value, f.jenis_tarif, true); setAuto((a) => { const n = new Set(a); n.delete("tujuan_provinsi"); return n; }); }}>
              <option value="">— pilih tujuan —</option>
              {sbu.map((s) => <option key={s.id} value={s.tujuan}>{s.tujuan}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Kota / Lokasi Kegiatan{A("tujuan_kota")}</label>
            <input className="field" value={f.tujuan_kota} onChange={(e) => set("tujuan_kota", e.target.value)} placeholder="mis. Surabaya" />
          </div>
          <div>
            <label className="field-label">Jenis Uang Harian</label>
            <select className="field" value={f.jenis_tarif} onChange={(e) => { setTarifManual(false); pilihTujuan(f.tujuan_provinsi, e.target.value as any, true); }}>
              <option value="perjalanan">Perjalanan Dinas Dalam Negeri</option>
              <option value="rapat">Rapat / Pertemuan</option>
              <option value="diklat">Pendidikan &amp; Pelatihan</option>
            </select>
          </div>
          <div>
            <label className="field-label">Tarif per Orang per Hari (Rp){A("tarif_uang_harian")}</label>
            <input type="number" min={0} className="field" value={f.tarif_uang_harian} onChange={(e) => { setTarifManual(true); set("tarif_uang_harian", Number(e.target.value)); }} />
          </div>
        </div>
        {sbuTerpilih && f.tarif_uang_harian === 0 && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Tarif SBU untuk &quot;{sbuTerpilih.tujuan}&quot; pada jenis ini = Rp 0 (mis. perjalanan dalam kota tidak mendapat uang harian). Ubah jenis uang harian atau isi tarif secara manual bila perlu.
          </p>
        )}
      </Section>

      {/* 4. Pelaksana */}
      <Section no={4} title="Pegawai Pelaksana" desc="Satu kuitansi (satu halaman) dibuat untuk setiap pegawai yang dipilih.">
        {f.pegawai_ids.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {f.pegawai_ids.map((id) => {
              const p = pegawai.find((x) => x.id === id);
              return p ? (
                <span key={id} className="chip bg-brand-50 text-brand-800 ring-brand-200">
                  {p.nama}
                  <button type="button" onClick={() => set("pegawai_ids", f.pegawai_ids.filter((x) => x !== id))} aria-label="Hapus"><X className="h-3 w-3" /></button>
                </span>
              ) : null;
            })}
            {auto.has("pegawai_ids") && <Auto />}
          </div>
        )}
        <div className="relative mb-2">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="field pl-9" placeholder="Cari nama, NIP, atau jabatan…" value={cari} onChange={(e) => setCari(e.target.value)} />
        </div>
        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
          {pegawaiTampil.length === 0 && <p className="p-4 text-sm text-slate-500">Tidak ada pegawai. Tambahkan di menu Data Pegawai.</p>}
          {pegawaiTampil.map((p) => {
            const on = f.pegawai_ids.includes(p.id);
            return (
              <label key={p.id} className={`flex items-start gap-3 px-3.5 py-2.5 cursor-pointer text-sm transition-colors ${on ? "bg-brand-50/60" : "hover:bg-slate-50"}`}>
                <input type="checkbox" className="mt-1 accent-[#237469]" checked={on}
                  onChange={() => set("pegawai_ids", on ? f.pegawai_ids.filter((x) => x !== p.id) : [...f.pegawai_ids, p.id])} />
                <span className="min-w-0">
                  <span className="block text-slate-800 font-medium">{p.nama}</span>
                  <span className="block text-xs text-slate-500">{p.nip} · {p.pangkat_gol || "-"} · {p.jabatan || "-"}</span>
                </span>
              </label>
            );
          })}
        </div>
      </Section>

      {/* 5. Biaya lain */}
      <Section no={5} title="Biaya Lainnya (opsional)" desc="Mis. penginapan atau transportasi. Jumlah per orang; ditambahkan ke setiap kuitansi.">
        <div className="space-y-2">
          {f.biaya_lain.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_9rem_2.25rem] gap-2">
              <input className="field" placeholder="Uraian (mis. Penginapan 2 malam)" value={b.uraian}
                onChange={(e) => set("biaya_lain", f.biaya_lain.map((x, j) => (j === i ? { ...x, uraian: e.target.value } : x)))} />
              <input type="number" min={0} className="field" placeholder="Rp" value={b.jumlah || ""}
                onChange={(e) => set("biaya_lain", f.biaya_lain.map((x, j) => (j === i ? { ...x, jumlah: Number(e.target.value) } : x)))} />
              <button type="button" className="btn-secondary !px-0" aria-label="Hapus baris" onClick={() => set("biaya_lain", f.biaya_lain.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn-secondary mt-3" disabled={f.biaya_lain.length >= 12}
          onClick={() => set("biaya_lain", [...f.biaya_lain, { uraian: "", jumlah: 0 }])}>
          <Plus className="h-4 w-4" /> Tambah biaya
        </button>
      </Section>

      {/* 6. Anggaran */}
      <Section no={6} title="Beban Anggaran" desc="Program, kegiatan, sub kegiatan, belanja, dan PPTK diambil dari data DPA aplikasi.">
        <label className="field-label">Rekening Belanja <span className="text-rose-500">*</span></label>
        <select className="field" value={f.dpa_id} onChange={(e) => set("dpa_id", e.target.value)}>
          <option value="">— pilih rekening —</option>
          {dpaTampil.map((d) => <option key={d.id} value={d.id}>{d.kode_rekening} · {d.jenis_belanja} — {d.sub_kegiatan}</option>)}
        </select>
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
          <input type="checkbox" className="accent-[#237469]" checked={semuaRek} onChange={(e) => setSemuaRek(e.target.checked)} />
          Tampilkan semua rekening (bukan hanya Belanja Perjalanan Dinas)
        </label>
        {dpa.length > 0 && !dpa.some((d) => d.perjalanan) && !semuaRek && (
          <p className="mt-2 text-xs text-amber-700">Belum ada rekening Belanja Perjalanan Dinas pada periode aktif. Centang opsi di atas untuk melihat semua rekening.</p>
        )}
        {dpaDipilih && (
          <dl className="mt-4 grid sm:grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 text-sm rounded-xl bg-slate-50 border border-slate-200/70 p-4">
            {([["Program", dpaDipilih.program], ["Kegiatan", dpaDipilih.kegiatan], ["Sub Kegiatan", dpaDipilih.sub_kegiatan], ["Belanja", dpaDipilih.jenis_belanja], ["Kode Rekening", dpaDipilih.kode_rekening], ["PPTK", dpaDipilih.pptk]] as const).map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-slate-500">{k}</dt><dd className="text-slate-800">{v}</dd></div>
            ))}
          </dl>
        )}
      </Section>

      {/* Ringkasan & simpan */}
      <div className="card p-5 sm:p-6 sticky bottom-3 shadow-lift border-brand-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            <p>{jmlPeserta} pegawai × {lama || 0} hari × Rp {rp(f.tarif_uang_harian)}{biayaLainTotal > 0 && <> + biaya lain Rp {rp(biayaLainTotal)}</>} per orang</p>
            <p className="mt-0.5">Total: <b className="text-lg text-slate-900 font-serif">Rp {rp(totalOrang * jmlPeserta)}</b>
              <span className="text-xs text-slate-400"> (Rp {rp(totalOrang)} per orang)</span></p>
          </div>
          <button type="button" onClick={simpan} disabled={menyimpan} className="btn-primary !px-6 !py-2.5">
            {menyimpan ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan…</> : edit ? "Simpan Perubahan" : "Simpan & Buat Kuitansi"}
          </button>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
        {sukses && (
          <div className="mt-3 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
            <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> Perubahan tersimpan.</p>
            {sukses.peringatan.map((w, i) => <p key={i} className="text-amber-700 mt-1">{w}</p>)}
            <div className="mt-2 flex flex-wrap gap-2">
              <a className="btn-secondary !py-1.5" href={`/api/perjalanan-dinas/${sukses.id}/kuitansi`}><Download className="h-4 w-4" /> Kuitansi (penanda merah)</a>
              <a className="btn-secondary !py-1.5" href={`/api/perjalanan-dinas/${sukses.id}/kuitansi?warna=hitam`}><Download className="h-4 w-4" /> Kuitansi (siap cetak)</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
