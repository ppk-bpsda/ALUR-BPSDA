"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2 } from "lucide-react";

type Rincian = { nama_item: string; qty: number; satuan: string; harga_satuan: number };
type Potongan = { jenis_pajak: string; persentase: number; nominal: number };

const PAJAK_DEFAULT: Potongan[] = [
  { jenis_pajak: "Pajak Daerah 10%", persentase: 10, nominal: 0 },
  { jenis_pajak: "PPH Final", persentase: 0, nominal: 0 },
  { jenis_pajak: "PPH 22 (1,5%)", persentase: 1.5, nominal: 0 },
  { jenis_pajak: "PPH 23 (2%)", persentase: 2, nominal: 0 },
];

export default function PengajuanBaruPage() {
  const router = useRouter();
  const supabase = createClient();

  const [dpaOptions, setDpaOptions] = useState<any[]>([]);
  const [penyediaOptions, setPenyediaOptions] = useState<any[]>([]);
  const [penerimaSaran, setPenerimaSaran] = useState<string[]>([]);
  const [periode, setPeriode] = useState<{ tahun: number; tahapan: string } | null>(null);

  const [dpaId, setDpaId] = useState("");
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [uraian, setUraian] = useState("");
  const [penyediaId, setPenyediaId] = useState("");
  const [namaPenerima, setNamaPenerima] = useState("");
  const [rincian, setRincian] = useState<Rincian[]>([{ nama_item: "", qty: 1, satuan: "", harga_satuan: 0 }]);
  const [potongan, setPotongan] = useState<Potongan[]>(PAJAK_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      // Periode aktif (tahun + tahapan) disimpan di cookie httpOnly oleh
      // server saat login/ganti periode -- diambil lewat endpoint kecil
      // ini supaya pilihan rekening/DPA yang muncul selalu sesuai
      // tahapan yang sedang aktif, bukan semua tahapan tercampur.
      const periodeRes = await fetch("/api/periode-aktif").then((r) => r.json());
      setPeriode(periodeRes);

      const { data: dpa } = await supabase
        .from("dpa")
        .select(
          "id, tahapan, pagu_anggaran, rekening:rekening_belanja(kode_rekening, jenis_belanja, sub_kegiatan:sub_kegiatan(nama_sub_kegiatan))"
        )
        .eq("tahun_anggaran", periodeRes.tahun)
        .eq("tahapan", periodeRes.tahapan);
      setDpaOptions(dpa ?? []);

      const { data: penyedia } = await supabase.from("penyedia").select("id, nama_penyedia").order("nama_penyedia");
      setPenyediaOptions(penyedia ?? []);

      // Tidak ada lagi tabel `penerima` terpisah (sudah dihapus dari skema)
      // -- nama penerima sekarang teks bebas, tapi tetap dikasih saran
      // (datalist) dari nama-nama yang pernah dipakai sebelumnya supaya
      // penulisannya konsisten.
      const { data: pernahDipakai } = await supabase
        .from("pengajuan_belanja")
        .select("nama_penerima")
        .not("nama_penerima", "is", null)
        .limit(200);
      const unik = Array.from(new Set((pernahDipakai ?? []).map((r: any) => r.nama_penerima).filter(Boolean)));
      setPenerimaSaran(unik as string[]);
    })();
  }, []);

  const totalBelanja = rincian.reduce((s, r) => s + Number(r.qty || 0) * Number(r.harga_satuan || 0), 0);

  function updateRincian(i: number, patch: Partial<Rincian>) {
    setRincian((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function updatePotongan(i: number, patch: Partial<Potongan>) {
    setPotongan((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  async function handleSubmit() {
    setErrorMsg("");
    if (!dpaId) return setErrorMsg("Pilih rekening/DPA dulu.");
    if (!uraian.trim()) return setErrorMsg("Uraian kegiatan wajib diisi.");
    if (rincian.some((r) => !r.nama_item || !r.satuan)) return setErrorMsg("Lengkapi semua rincian item.");

    setSaving(true);
    const res = await fetch("/api/pengajuan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dpa_id: dpaId,
        tanggal,
        uraian_kegiatan: uraian,
        penyedia_id: penyediaId || null,
        nama_penerima: namaPenerima.trim() || null,
        rincian,
        potongan: potongan.filter((p) => p.nominal > 0),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json();
      setErrorMsg(j.error || "Gagal menyimpan.");
      return;
    }
    router.push("/pengajuan");
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-serif text-xl text-slate-900">Pengajuan Belanja Baru</h1>
        <p className="text-sm text-slate-500">
          Isi sekali di sini -- Nota Dinas, SPP/SPTJB, dan Kwitansi GU akan dibuat otomatis dari data yang sama.
          {periode && (
            <> Daftar rekening di bawah mengikuti periode aktif: Tahun Anggaran {periode.tahun}, Tahapan{" "}
              {periode.tahapan}.</>
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
                  {d.rekening?.kode_rekening} -- {d.rekening?.jenis_belanja} ({d.tahapan})
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
              onChange={(e) => setPenyediaId(e.target.value)}
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
              onChange={(e) => setNamaPenerima(e.target.value)}
              placeholder="Ketik nama penerima"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
            />
            <datalist id="saran-penerima">
              {penerimaSaran.map((nama) => (
                <option key={nama} value={nama} />
              ))}
            </datalist>
            <p className="text-xs text-slate-400 mt-1">
              Ketik bebas -- saran muncul dari nama yang pernah dipakai sebelumnya.
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
        <p className="text-sm font-medium text-slate-900 mb-3">Potongan (isi 0 jika tidak ada)</p>
        <div className="space-y-2">
          {potongan.map((p, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <span className="col-span-5 text-sm text-slate-600">{p.jenis_pajak}</span>
              <input
                type="number"
                value={p.nominal}
                onChange={(e) => updatePotongan(i, { nominal: Number(e.target.value) })}
                className="col-span-3 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-5 py-2.5"
      >
        {saving ? "Menyimpan..." : "Simpan Pengajuan"}
      </button>
    </div>
  );
}
