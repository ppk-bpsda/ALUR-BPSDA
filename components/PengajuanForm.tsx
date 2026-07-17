"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Sparkles } from "lucide-react";

type Rincian = { nama_item: string; qty: number; satuan: string; harga_satuan: number };
type Potongan = { jenis_pajak: string; persentase: number; nominal: number };
type JenisPengadaan = "barang" | "jasa_umum" | "jasa_boga_hotel";

// ---------------------------------------------------------
// Tarif pajak pengadaan barang/jasa pemerintah -- berdasarkan aturan umum
// yang berlaku (UU HPP, PP 23/2018, PMK terkait PPh 22/23). Ini alat
// bantu hitung, BUKAN nasihat pajak -- Bendahara tetap wajib
// memverifikasi status PKP/NPWP penyedia dan tarif yang berlaku saat
// transaksi, karena aturan pajak bisa berubah.
// ---------------------------------------------------------
const TARIF = {
  ppn: 0.11,
  batasMinPpnPph22: 2_000_000, // di bawah ini PPN & PPh 22 umumnya tidak dipungut
  pph22: 0.015,
  pph22TanpaNpwp: 0.03,
  pph23: 0.02,
  pph23TanpaNpwp: 0.04,
  pphFinalUmkm: 0.005,
  pajakDaerahRestoranHotel: 0.10,
};

function hitungPajakOtomatis({
  totalBelanja,
  jenisPengadaan,
  adaNpwp,
  pakaiPphFinal,
}: {
  totalBelanja: number;
  jenisPengadaan: JenisPengadaan;
  adaNpwp: boolean;
  pakaiPphFinal: boolean;
}): Potongan[] {
  if (totalBelanja <= 0) return [];

  // Jasa boga/katering & hotel: bukan objek PPh 23 (dikecualikan per
  // ketentuan), dan biasanya bukan objek PPN tapi Pajak Daerah (PB1) yang
  // sudah self-assessment oleh restoran/hotel -- jadi cukup ditampilkan
  // sebagai informasi, tidak dipotong Bendahara.
  if (jenisPengadaan === "jasa_boga_hotel") {
    const dppInfo = totalBelanja / (1 + TARIF.pajakDaerahRestoranHotel);
    return [
      {
        jenis_pajak: "Pajak Daerah Restoran/Hotel 10% (informasi -- umumnya sudah termasuk di harga)",
        persentase: 10,
        nominal: Math.round(totalBelanja - dppInfo),
      },
    ];
  }

  const dpp = totalBelanja / (1 + TARIF.ppn);
  const hasil: Potongan[] = [];

  if (dpp >= TARIF.batasMinPpnPph22) {
    hasil.push({ jenis_pajak: "PPN 11%", persentase: 11, nominal: Math.round(totalBelanja - dpp) });
  }

  if (pakaiPphFinal) {
    hasil.push({
      jenis_pajak: "PPh Final UMKM (PP 23/2018) 0,5%",
      persentase: 0.5,
      nominal: Math.round(dpp * TARIF.pphFinalUmkm),
    });
  } else if (jenisPengadaan === "barang") {
    if (dpp >= TARIF.batasMinPpnPph22) {
      const tarif = adaNpwp ? TARIF.pph22 : TARIF.pph22TanpaNpwp;
      hasil.push({
        jenis_pajak: `PPh 22 ${adaNpwp ? "1,5%" : "3% (tanpa NPWP)"}`,
        persentase: tarif * 100,
        nominal: Math.round(dpp * tarif),
      });
    }
  } else {
    const tarif = adaNpwp ? TARIF.pph23 : TARIF.pph23TanpaNpwp;
    hasil.push({
      jenis_pajak: `PPh 23 ${adaNpwp ? "2%" : "4% (tanpa NPWP)"}`,
      persentase: tarif * 100,
      nominal: Math.round(dpp * tarif),
    });
  }

  return hasil;
}

export default function PengajuanForm({
  mode,
  pengajuanId,
}: {
  mode: "create" | "edit";
  pengajuanId?: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [dpaOptions, setDpaOptions] = useState<any[]>([]);
  const [penyediaOptions, setPenyediaOptions] = useState<any[]>([]);
  const [penerimaSaran, setPenerimaSaran] = useState<string[]>([]);
  const [periode, setPeriode] = useState<{ tahun: number; tahapan: string } | null>(null);
  const [sisaAnggaran, setSisaAnggaran] = useState<number | null>(null);
  const [loading, setLoading] = useState(mode === "edit");

  const [dpaId, setDpaId] = useState("");
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [uraian, setUraian] = useState("");
  const [penyediaId, setPenyediaId] = useState("");
  const [namaPenerima, setNamaPenerima] = useState("");
  const [penerimaDiubahManual, setPenerimaDiubahManual] = useState(false);
  const [rincian, setRincian] = useState<Rincian[]>([{ nama_item: "", qty: 1, satuan: "", harga_satuan: 0 }]);
  const [potongan, setPotongan] = useState<Potongan[]>([]);
  const [jenisPengadaan, setJenisPengadaan] = useState<JenisPengadaan>("barang");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: penyedia } = await supabase
        .from("penyedia")
        .select("id, nama_penyedia, nama_direktur, npwp, pph_final_umkm")
        .order("nama_penyedia");
      setPenyediaOptions(penyedia ?? []);

      // Tidak ada lagi tabel `penerima` terpisah -- nama penerima teks
      // bebas, saran (datalist) diambil dari nama yang pernah dipakai.
      const { data: pernahDipakai } = await supabase
        .from("pengajuan_belanja")
        .select("nama_penerima")
        .not("nama_penerima", "is", null)
        .limit(200);
      const unik = Array.from(new Set((pernahDipakai ?? []).map((r: any) => r.nama_penerima).filter(Boolean)));
      setPenerimaSaran(unik as string[]);

      if (mode === "edit" && pengajuanId) {
        // Mode edit: rekening/DPA yang boleh dipilih mengikuti periode
        // (tahun+tahapan) milik pengajuan itu SENDIRI, bukan periode aktif
        // saat ini -- supaya tetap konsisten kalau periode aktif sudah
        // berganti sejak pengajuan ini dibuat.
        const { data: existing } = await supabase
          .from("pengajuan_belanja")
          .select(
            "id, dpa_id, tanggal, uraian_kegiatan, penyedia_id, nama_penerima, dpa:dpa(tahun_anggaran, tahapan)"
          )
          .eq("id", pengajuanId)
          .single();

        if (existing) {
          setDpaId(existing.dpa_id);
          setTanggal(existing.tanggal);
          setUraian(existing.uraian_kegiatan);
          setPenyediaId(existing.penyedia_id ?? "");
          setNamaPenerima(existing.nama_penerima ?? "");
          setPenerimaDiubahManual(true); // jangan timpa nama penerima yang sudah tersimpan

          const dpaPeriode = existing.dpa as any;
          setPeriode({ tahun: dpaPeriode?.tahun_anggaran, tahapan: dpaPeriode?.tahapan });

          const { data: dpa } = await supabase
            .from("dpa")
            .select(
              "id, tahapan, pagu_anggaran, pptk:pejabat_skpd(nama), rekening:rekening_belanja(kode_rekening, jenis_belanja, sumber_dana, sub_kegiatan:sub_kegiatan(nama_sub_kegiatan))"
            )
            .eq("tahun_anggaran", dpaPeriode?.tahun_anggaran)
            .eq("tahapan", dpaPeriode?.tahapan);
          setDpaOptions(dpa ?? []);

          const [{ data: rincianData }, { data: potonganData }] = await Promise.all([
            supabase.from("rincian_belanja").select("nama_item, qty, satuan, harga_satuan").eq("pengajuan_id", pengajuanId),
            supabase.from("potongan_pajak").select("jenis_pajak, persentase, nominal").eq("pengajuan_id", pengajuanId),
          ]);
          if (rincianData && rincianData.length > 0) setRincian(rincianData as Rincian[]);
          if (potonganData) setPotongan(potonganData as Potongan[]);
        }
        setLoading(false);
      } else {
        // Mode tambah: periode aktif (tahun+tahapan) disimpan di cookie
        // httpOnly server, diambil lewat endpoint kecil ini.
        const periodeRes = await fetch("/api/periode-aktif").then((r) => r.json());
        setPeriode(periodeRes);

        const { data: dpa } = await supabase
          .from("dpa")
          .select(
            "id, tahapan, pagu_anggaran, pptk:pejabat_skpd(nama), rekening:rekening_belanja(kode_rekening, jenis_belanja, sumber_dana, sub_kegiatan:sub_kegiatan(nama_sub_kegiatan))"
          )
          .eq("tahun_anggaran", periodeRes.tahun)
          .eq("tahapan", periodeRes.tahapan);
        setDpaOptions(dpa ?? []);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dpaTerpilih = useMemo(() => dpaOptions.find((d: any) => d.id === dpaId), [dpaOptions, dpaId]);
  const penyediaTerpilih = useMemo(
    () => penyediaOptions.find((p: any) => p.id === penyediaId),
    [penyediaOptions, penyediaId]
  );

  // Sisa anggaran rekening yang dipilih -- pagu dikurangi realisasi lain
  // yang sudah disetujui/dicairkan (di luar pengajuan yang sedang diedit).
  useEffect(() => {
    if (!dpaId) return setSisaAnggaran(null);
    (async () => {
      const { data: realisasiLain } = await supabase
        .from("pengajuan_belanja")
        .select("id, jumlah_pengajuan")
        .eq("dpa_id", dpaId)
        .in("status", ["disetujui", "dicairkan"]);
      const totalRealisasiLain = (realisasiLain ?? [])
        .filter((r: any) => r.id !== pengajuanId)
        .reduce((s: number, r: any) => s + Number(r.jumlah_pengajuan || 0), 0);
      const pagu = dpaOptions.find((d: any) => d.id === dpaId)?.pagu_anggaran ?? 0;
      setSisaAnggaran(Number(pagu) - totalRealisasiLain);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dpaId, dpaOptions]);

  // Penyedia dipilih -> nama penerima kwitansi otomatis diisi dari nama
  // Direktur (sesuai data Penyedia Barang/Jasa), selama belum diubah
  // manual oleh Bendahara.
  function handlePilihPenyedia(id: string) {
    setPenyediaId(id);
    if (!penerimaDiubahManual) {
      const p = penyediaOptions.find((x: any) => x.id === id);
      setNamaPenerima(p?.nama_direktur || "");
    }
  }

  const totalBelanja = rincian.reduce((s, r) => s + Number(r.qty || 0) * Number(r.harga_satuan || 0), 0);

  function updateRincian(i: number, patch: Partial<Rincian>) {
    setRincian((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function updatePotongan(i: number, patch: Partial<Potongan>) {
    setPotongan((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function handleHitungOtomatis() {
    const hasil = hitungPajakOtomatis({
      totalBelanja,
      jenisPengadaan,
      adaNpwp: Boolean(penyediaTerpilih?.npwp),
      pakaiPphFinal: Boolean(penyediaTerpilih?.pph_final_umkm),
    });
    setPotongan(hasil);
  }

  async function handleSubmit() {
    setErrorMsg("");
    if (!dpaId) return setErrorMsg("Pilih rekening/DPA dulu.");
    if (!uraian.trim()) return setErrorMsg("Uraian kegiatan wajib diisi.");
    if (rincian.some((r) => !r.nama_item || !r.satuan)) return setErrorMsg("Lengkapi semua rincian item.");

    setSaving(true);
    const payload = {
      dpa_id: dpaId,
      tanggal,
      uraian_kegiatan: uraian,
      penyedia_id: penyediaId || null,
      nama_penerima: namaPenerima.trim() || null,
      rincian,
      potongan: potongan.filter((p) => p.nominal !== 0),
    };

    const res =
      mode === "edit"
        ? await fetch(`/api/pengajuan/${pengajuanId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/pengajuan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

    setSaving(false);
    if (!res.ok) {
      const j = await res.json();
      setErrorMsg(j.error || "Gagal menyimpan.");
      return;
    }
    router.push("/pengajuan");
    router.refresh();
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Memuat data pengajuan...</p>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-serif text-xl text-slate-900">
          {mode === "edit" ? "Edit Pengajuan Belanja" : "Pengajuan Belanja Baru"}
        </h1>
        <p className="text-sm text-slate-500">
          Isi sekali di sini -- Nota Dinas, SPP/SPTJB, dan Kwitansi GU akan dibuat otomatis dari data yang sama.
          {periode && (
            <> Daftar rekening di bawah mengikuti periode {mode === "edit" ? "milik pengajuan ini" : "aktif"}:
              Tahun Anggaran {periode.tahun}, Tahapan {periode.tahapan}.</>
          )}
        </p>
      </div>

      {errorMsg && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{errorMsg}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Rekening / DPA</label>
            <select
              value={dpaId}
              onChange={(e) => setDpaId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
            >
              <option value="">-- pilih rekening --</option>
              {dpaOptions.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.rekening?.kode_rekening} -- {d.rekening?.jenis_belanja}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Tanggal</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
            />
          </div>
        </div>

        {dpaTerpilih && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-600 grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            <p><span className="text-slate-400">Sub Kegiatan:</span> {dpaTerpilih.rekening?.sub_kegiatan?.nama_sub_kegiatan || "-"}</p>
            <p><span className="text-slate-400">Sumber Dana:</span> {dpaTerpilih.rekening?.sumber_dana || "-"}</p>
            <p><span className="text-slate-400">PPTK:</span> {dpaTerpilih.pptk?.nama || "-- belum ditentukan di Rekening & Pagu --"}</p>
            <p><span className="text-slate-400">Pagu:</span> Rp {Number(dpaTerpilih.pagu_anggaran || 0).toLocaleString("id-ID")}</p>
            {sisaAnggaran !== null && (
              <p className="sm:col-span-2">
                <span className="text-slate-400">Sisa Anggaran (setelah pengajuan ini):</span>{" "}
                <span className={sisaAnggaran - totalBelanja < 0 ? "text-rose-600 font-medium" : "text-emerald-700 font-medium"}>
                  Rp {(sisaAnggaran - totalBelanja).toLocaleString("id-ID")}
                </span>
              </p>
            )}
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Uraian Kegiatan (lengkap)</label>
          <textarea
            value={uraian}
            onChange={(e) => setUraian(e.target.value)}
            rows={3}
            placeholder="mis. Rapat evaluasi penggunaan anggaran DBH CHT Tahun 2026 dan persiapan penyusunan P-RKP..."
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Penyedia (opsional -- cari & pilih)</label>
            <select
              value={penyediaId}
              onChange={(e) => handlePilihPenyedia(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
            >
              <option value="">-- tidak lewat penyedia --</option>
              {penyediaOptions.map((p: any) => (
                <option key={p.id} value={p.id}>{p.nama_penyedia}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Penerima Uang GU</label>
            <input
              list="saran-penerima"
              value={namaPenerima}
              onChange={(e) => {
                setNamaPenerima(e.target.value);
                setPenerimaDiubahManual(true);
              }}
              placeholder="Ketik nama penerima"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
            />
            <datalist id="saran-penerima">
              {penerimaSaran.map((nama) => (
                <option key={nama} value={nama} />
              ))}
            </datalist>
            <p className="text-xs text-slate-400 mt-1">
              Otomatis terisi dari Nama Direktur saat memilih Penyedia -- bisa diketik ulang manual bila perlu.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-900">Rincian Item</p>
          <button
            onClick={() => setRincian([...rincian, { nama_item: "", qty: 1, satuan: "", harga_satuan: 0 }])}
            className="text-xs flex items-center gap-1 text-emerald-600 font-medium"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah item
          </button>
        </div>
        <div className="space-y-2">
          {rincian.map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                placeholder="Nama item"
                value={r.nama_item}
                onChange={(e) => updateRincian(i, { nama_item: e.target.value })}
                className="col-span-4 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
              />
              <input
                type="number"
                placeholder="Qty"
                value={r.qty}
                onChange={(e) => updateRincian(i, { qty: Number(e.target.value) })}
                className="col-span-2 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
              />
              <input
                placeholder="Satuan"
                value={r.satuan}
                onChange={(e) => updateRincian(i, { satuan: e.target.value })}
                className="col-span-2 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
              />
              <input
                type="number"
                placeholder="Harga satuan"
                value={r.harga_satuan}
                onChange={(e) => updateRincian(i, { harga_satuan: Number(e.target.value) })}
                className="col-span-3 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
              />
              <button
                onClick={() => setRincian(rincian.filter((_, idx) => idx !== i))}
                className="col-span-1 text-rose-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <p className="text-sm font-medium text-slate-900 mt-3">
          Total: Rp {totalBelanja.toLocaleString("id-ID")}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-900">Potongan Pajak</p>
        </div>

        <div className="flex flex-wrap items-end gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Jenis Pengadaan</label>
            <select
              value={jenisPengadaan}
              onChange={(e) => setJenisPengadaan(e.target.value as JenisPengadaan)}
              className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
            >
              <option value="barang">Barang</option>
              <option value="jasa_umum">Jasa Umum</option>
              <option value="jasa_boga_hotel">Jasa Boga/Katering/Hotel</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleHitungOtomatis}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg px-3 py-2"
          >
            <Sparkles className="h-3.5 w-3.5" /> Hitung Otomatis
          </button>
          <p className="text-xs text-slate-400 flex-1 min-w-[220px]">
            Berdasarkan tarif umum saat ini (PPN 11%, PPh 22/23, PPh Final UMKM 0,5% bila Penyedia
            bertanda PP 23) dan status NPWP Penyedia yang dipilih. Alat bantu hitung, bukan nasihat
            pajak -- Bendahara tetap wajib memverifikasi sebelum SPJ diajukan.
          </p>
        </div>

        <div className="space-y-2">
          {potongan.length === 0 && (
            <p className="text-xs text-slate-400 py-2">
              Belum ada potongan. Klik "Hitung Otomatis" atau tambah manual di bawah.
            </p>
          )}
          {potongan.map((p, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                value={p.jenis_pajak}
                onChange={(e) => updatePotongan(i, { jenis_pajak: e.target.value })}
                className="col-span-7 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
              />
              <input
                type="number"
                value={p.nominal}
                onChange={(e) => updatePotongan(i, { nominal: Number(e.target.value) })}
                className="col-span-4 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
              />
              <button
                onClick={() => setPotongan(potongan.filter((_, idx) => idx !== i))}
                className="col-span-1 text-rose-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setPotongan([...potongan, { jenis_pajak: "", persentase: 0, nominal: 0 }])}
          className="mt-3 text-xs flex items-center gap-1 text-emerald-600 font-medium"
        >
          <Plus className="h-3.5 w-3.5" /> Tambah potongan manual
        </button>

        {potongan.length > 0 && (
          <p className="text-sm font-medium text-slate-900 mt-4 pt-3 border-t border-slate-100">
            Jumlah Diterima Bersih: Rp{" "}
            {(totalBelanja - potongan.reduce((s, p) => s + Number(p.nominal || 0), 0)).toLocaleString("id-ID")}
          </p>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-5 py-2.5"
      >
        {saving ? "Menyimpan..." : mode === "edit" ? "Simpan Perubahan" : "Simpan Pengajuan"}
      </button>
    </div>
  );
}
