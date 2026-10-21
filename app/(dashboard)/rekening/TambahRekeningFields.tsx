"use client";

import { useState } from "react";

type SubKegiatan = { id: string; kode_sub_kegiatan: string; nama_sub_kegiatan: string };
type Belanja = { kode_belanja: string; nama_belanja: string };

const labelBelanja = (b: Belanja) => `${b.kode_belanja} — ${b.nama_belanja}`;

/**
 * Empat isian pertama form "Tambah Rekening & Pagu Baru" (Sub Kegiatan,
 * Kode Rekening lengkap, Uraian Belanja, Jenis Rek.) + kotak pencarian
 * Katalog Kode Rekening Belanja (opsional).
 *
 * Memilih dari katalog otomatis mengisi:
 *   - Kode Rekening lengkap = kode sub kegiatan + "." + kode belanja
 *   - Uraian Belanja
 *   - Jenis Rek. (5.2.* = Belanja Modal, selain itu Belanja Barang/Jasa)
 * Semua isian tetap bisa diubah manual. Kalau katalog kosong (mis. migrasi
 * belum dijalankan) kotak katalog disembunyikan dan form bekerja seperti biasa.
 */
export default function TambahRekeningFields({
  subKegiatan,
  katalog,
}: {
  subKegiatan: SubKegiatan[];
  katalog: Belanja[];
}) {
  const [subId, setSubId] = useState("");
  const [teksKatalog, setTeksKatalog] = useState("");
  const [kodeBelanjaPilihan, setKodeBelanjaPilihan] = useState<string | null>(null);
  const [kode, setKode] = useState("");
  const [uraian, setUraian] = useState("");
  const [jenis, setJenis] = useState("Belanja Barang/Jasa");

  const subTerpilih = subKegiatan.find((s) => s.id === subId);

  function pilihSub(id: string) {
    setSubId(id);
    const sk = subKegiatan.find((s) => s.id === id);
    // Kode ikut menyesuaikan HANYA bila sebelumnya diisi otomatis dari katalog
    if (kodeBelanjaPilihan && sk) setKode(`${sk.kode_sub_kegiatan}.${kodeBelanjaPilihan}`);
  }

  function ketikKatalog(nilai: string) {
    setTeksKatalog(nilai);
    const t = nilai.trim();
    const b = katalog.find((x) => labelBelanja(x) === t) ?? katalog.find((x) => x.kode_belanja === t);
    if (!b) {
      setKodeBelanjaPilihan(null);
      return;
    }
    setKodeBelanjaPilihan(b.kode_belanja);
    setKode(subTerpilih ? `${subTerpilih.kode_sub_kegiatan}.${b.kode_belanja}` : b.kode_belanja);
    setUraian(b.nama_belanja);
    setJenis(b.kode_belanja.startsWith("5.2.") ? "Belanja Modal" : "Belanja Barang/Jasa");
  }

  return (
    <>
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-slate-600 mb-1 block">Sub Kegiatan</label>
        <select
          name="sub_kegiatan_id"
          required
          value={subId}
          onChange={(e) => pilihSub(e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
        >
          <option value="" disabled>Pilih sub kegiatan</option>
          {subKegiatan.map((sk) => (
            <option key={sk.id} value={sk.id}>
              {sk.kode_sub_kegiatan} -- {sk.nama_sub_kegiatan}
            </option>
          ))}
        </select>
      </div>

      {katalog.length > 0 && (
        <div className="sm:col-span-4">
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            Cari di Katalog Kode Rekening Belanja <span className="text-slate-400 font-normal">(opsional)</span>
          </label>
          <input
            type="text"
            list="katalog-belanja"
            value={teksKatalog}
            onChange={(e) => ketikKatalog(e.target.value)}
            placeholder="Ketik kode atau nama belanja, mis. alat tulis kantor"
            autoComplete="off"
            className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
          />
          <datalist id="katalog-belanja">
            {katalog.map((b) => (
              <option key={b.kode_belanja} value={labelBelanja(b)} />
            ))}
          </datalist>
        </div>
      )}

      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-slate-600 mb-1 block">Kode Rekening (Lengkap)</label>
        <input
          name="kode_rekening"
          required
          value={kode}
          onChange={(e) => {
            setKode(e.target.value);
            setKodeBelanjaPilihan(null); // sudah diubah manual -- jangan ditimpa otomatis lagi
          }}
          placeholder="mis. 4.01.01.2.06.0002.5.1.02.01.001.00024"
          className="w-full text-sm font-mono border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
        />
        <p className="text-[10px] text-slate-400 mt-1">
          Kode LENGKAP = kode sub kegiatan + kode rekening belanja. Jika yang diisi hanya kode belanja (6 segmen),
          sistem otomatis menambahkan kode sub kegiatan yang dipilih -- supaya tidak dobel.
        </p>
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-slate-600 mb-1 block">Uraian Belanja</label>
        <input
          name="jenis_belanja"
          required
          value={uraian}
          onChange={(e) => setUraian(e.target.value)}
          placeholder="mis. Belanja Alat Tulis Kantor"
          className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
        />
      </div>
      <div className="sm:col-span-1">
        <label className="text-xs font-medium text-slate-600 mb-1 block">Jenis Rek.</label>
        <select
          name="kelompok_belanja"
          value={jenis}
          onChange={(e) => setJenis(e.target.value)}
          title='Menentukan isi kolom "Jenis Rek." di Nota Dinas'
          className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
        >
          <option value="Belanja Barang/Jasa">Belanja Barang/Jasa</option>
          <option value="Belanja Modal">Belanja Modal</option>
        </select>
      </div>
    </>
  );
}
