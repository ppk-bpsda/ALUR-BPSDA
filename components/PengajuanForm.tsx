"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Sparkles, Info } from "lucide-react";

type Rincian = { nama_item: string; qty: number; satuan: string; harga_satuan: number };
type Potongan = { jenis_pajak: string; persentase: number; nominal: number };
type JenisPengadaan = "barang" | "jasa_umum" | "jasa_boga_hotel";
type BentukUsaha = "badan_usaha" | "perseorangan";

// ---------------------------------------------------------
// Tarif & aturan pemungutan pajak oleh Bendahara Pemerintah dalam
// pengadaan barang/jasa -- mengacu pada PMK 51/2025 (pemungutan PPh 22,
// menggantikan PMK 34/2017), PMK 131/2024 & PMK 11/2025 (PPN 12% dengan
// DPP Nilai Lain 11/12 -- tarif efektif untuk barang/jasa non-mewah
// TETAP 11%, jadi angka di kalkulator ini tidak berubah), PP 58/2023 &
// PMK 168/2023 (PPh 21 atas jasa Bukan Pegawai orang pribadi), PMK
// 141/2015 (jenis Jasa Lain objek PPh 23), dan PP 23/2018 (PPh Final
// UMKM). Ini alat bantu hitung, BUKAN nasihat pajak final -- Bendahara/
// PPK tetap wajib memverifikasi status PKP, NPWP, bentuk penyedia, dan
// ketentuan terbaru sebelum SPJ diajukan, karena aturan pajak bisa
// berubah dan setiap transaksi punya konteks masing-masing.
//
// Poin penting yang dijaga di sini:
// - PPN HANYA dipungut kalau penyedia berstatus PKP (non-PKP tidak boleh
//   menerbitkan Faktur Pajak, jadi bukan objek pemungutan PPN sama sekali
//   -- bukan sekadar 0%).
// - Batas Rp 2.000.000 (tidak termasuk PPN, per transaksi/nota, tidak
//   boleh dipecah) berlaku untuk PPN dan PPh 22 (pembelian BARANG).
// - Untuk JASA: kalau penyedia BADAN USAHA (PT/CV/koperasi/dll) -> PPh
//   23 (2%/4% tanpa NPWP), TIDAK ada batas minimum. Kalau penyedia
//   PERSEORANGAN (orang pribadi) -> BUKAN PPh 23, tapi PPh 21 Bukan
//   Pegawai (DPP 50% x bruto, tarif progresif Pasal 17 UU PPh: 5% s.d.
//   Rp60jt/tahun berjalan, 15% di atasnya s.d. Rp250jt, dst; +20% kalau
//   tanpa NPWP). Salah kaprah yang sering terjadi di lapangan justru
//   sebaliknya (PPh 21 dikira "khusus honor", PPh 23 dikira "khusus
//   jasa") -- yang benar, penentunya adalah BENTUK PENYEDIA, bukan jenis
//   pembayarannya.
// - Kalkulator ini memakai tarif lapisan PERTAMA (5%/6%) sebagai
//   estimasi PPh 21 Bukan Pegawai untuk SATU transaksi ini saja.
//   Kumulatif penghasilan orang pribadi yang sama dalam satu tahun pajak
//   (yang menentukan lapisan tarif progresif berikutnya kalau berulang)
//   TIDAK dilacak otomatis oleh aplikasi ini -- Bendahara wajib
//   mengecek manual kalau penyedia perseorangan yang sama menerima
//   pembayaran berulang dalam tahun berjalan.
// - Tarif PPh 22/23 dobel kalau penyedia tidak ber-NPWP.
// - PPh Final UMKM (PP 23/2018) menggantikan PPh 22/23/21 (bukan PPN)
//   kalau penyedia sudah punya Surat Keterangan, dan tidak punya batas
//   minimum.
// - Pengadaan lewat E-Katalog/E-Purchasing/Toko Daring LKPP (Sistem
//   Informasi Pengadaan Pemerintah): per PMK 58/2022, marketplace/ritel
//   daring pengadaan itu sendiri yang DITUNJUK sebagai pemungut PPN/PPh
//   22 dan menyetorkannya -- BUKAN Bendahara. Kalau pembayaran dilakukan
//   dengan mekanisme Pembayaran Langsung (LS) lewat kanal tersebut,
//   Bendahara semestinya TIDAK memungut lagi (hindari pungutan ganda).
//   Kalkulator ini mengasumsikan pengadaan non-marketplace (Bendahara
//   yang memungut langsung); untuk transaksi lewat marketplace resmi,
//   cek dulu apakah pajak sudah dipungut otomatis di sana.
// ---------------------------------------------------------
const TARIF = {
  ppn: 0.11,
  batasMinPpnPph22: 2_000_000,
  pph22: 0.015,
  pph22TanpaNpwp: 0.03,
  pph23: 0.02,
  pph23TanpaNpwp: 0.04,
  pph21BukanPegawaiLapisan1: 0.05,
  pphFinalUmkm: 0.005,
  pajakDaerahRestoranHotel: 0.10,
};

function hitungPajakOtomatis({
  totalBelanja,
  jenisPengadaan,
  statusPkp,
  adaNpwp,
  pakaiPphFinal,
  bentukUsaha,
}: {
  totalBelanja: number;
  jenisPengadaan: JenisPengadaan;
  statusPkp: boolean;
  adaNpwp: boolean;
  pakaiPphFinal: boolean;
  bentukUsaha: BentukUsaha;
}): { hasil: Potongan[]; catatan: string[] } {
  if (totalBelanja <= 0) return { hasil: [], catatan: [] };
  const catatan: string[] = [];

  // Jasa boga/katering & hotel: DIKECUALIKAN dari PPN (Pasal 4A UU PPN jo.
  // PMK 70/2022 -- karena sudah jadi objek Pajak Daerah/PBJT Makanan-
  // Minuman, untuk hindari pajak berganda), TAPI TETAP kena PPh 23 (badan)
  // / PPh 21 Bukan Pegawai (perseorangan) seperti jasa lain -- PMK
  // 141/2015 Pasal 1(6)(aj) TEGAS memasukkan jasa boga/katering sebagai
  // objek PPh 23. Ini koreksi dari asumsi umum yang keliru bahwa jasa
  // katering "dikecualikan pajak" sepenuhnya -- yang dikecualikan
  // hanyalah PPN-nya.
  if (jenisPengadaan === "jasa_boga_hotel") {
    const dppInfo = totalBelanja / (1 + TARIF.pajakDaerahRestoranHotel);
    catatan.push(
      "Jasa boga/katering/hotel dikecualikan dari PPN (sudah jadi objek Pajak Daerah PBJT Makanan-Minuman, " +
        "lazimnya self-assessment oleh restoran/hotel & sudah termasuk di harga struk -- baris Pajak Daerah di " +
        "bawah murni informasi, BUKAN dipungut Bendahara). Tapi PPh 23/21 di bawah TETAP dipungut seperti jasa lain."
    );
    const hasilBoga: Potongan[] = [
      {
        jenis_pajak: "Pajak Daerah Restoran/Hotel 10% (informasi -- umumnya sudah termasuk di harga)",
        persentase: 10,
        nominal: Math.round(totalBelanja - dppInfo),
      },
    ];
    if (pakaiPphFinal) {
      hasilBoga.push({
        jenis_pajak: "PPh Final UMKM (PP 23/2018) 0,5%",
        persentase: 0.5,
        nominal: Math.round(totalBelanja * TARIF.pphFinalUmkm),
      });
    } else if (bentukUsaha === "perseorangan") {
      const dppPph21 = totalBelanja * 0.5;
      const tarif = adaNpwp ? TARIF.pph21BukanPegawaiLapisan1 : TARIF.pph21BukanPegawaiLapisan1 * 1.2;
      hasilBoga.push({
        jenis_pajak: `PPh 21 Bukan Pegawai ${adaNpwp ? "5%" : "6% (tanpa NPWP)"} x 50% bruto`,
        persentase: tarif * 100,
        nominal: Math.round(dppPph21 * tarif),
      });
    } else {
      const tarif = adaNpwp ? TARIF.pph23 : TARIF.pph23TanpaNpwp;
      hasilBoga.push({
        jenis_pajak: `PPh 23 ${adaNpwp ? "2%" : "4% (tanpa NPWP)"}`,
        persentase: tarif * 100,
        nominal: Math.round(totalBelanja * tarif),
      });
    }
    return { hasil: hasilBoga, catatan };
  }

  const hasil: Potongan[] = [];

  // DPP: kalau penyedia PKP, harga diasumsikan sudah termasuk PPN (umum
  // berlaku termasuk untuk harga di E-Katalog LKPP) sehingga DPP dihitung
  // dari total dibagi 1,11. Kalau Non-PKP, tidak ada PPN yang terkandung
  // di harga, jadi DPP = harga penuh.
  const dpp = statusPkp ? totalBelanja / (1 + TARIF.ppn) : totalBelanja;

  if (!statusPkp) {
    catatan.push(
      "Penyedia Non-PKP -- tidak boleh memungut/menerbitkan Faktur Pajak, sehingga transaksi ini " +
        "bukan objek pemungutan PPN sama sekali (bukan 0%, memang tidak dipungut)."
    );
  }

  if (statusPkp) {
    if (dpp >= TARIF.batasMinPpnPph22) {
      hasil.push({ jenis_pajak: "PPN 11%", persentase: 11, nominal: Math.round(totalBelanja - dpp) });
    } else {
      catatan.push(
        `Nilai transaksi (DPP Rp${Math.round(dpp).toLocaleString("id-ID")}) di bawah Rp2.000.000 -- ` +
          "PPN tidak dipungut sesuai PMK-58/2022 Pasal 5, selama tidak dipecah dari transaksi lain."
      );
    }
  }

  if (pakaiPphFinal) {
    hasil.push({
      jenis_pajak: "PPh Final UMKM (PP 23/2018) 0,5%",
      persentase: 0.5,
      nominal: Math.round(dpp * TARIF.pphFinalUmkm),
    });
  } else if (jenisPengadaan === "barang") {
    // PPh 22 (barang): batas Rp2jt sama seperti PPN.
    if (dpp >= TARIF.batasMinPpnPph22) {
      const tarif = adaNpwp ? TARIF.pph22 : TARIF.pph22TanpaNpwp;
      hasil.push({
        jenis_pajak: `PPh 22 ${adaNpwp ? "1,5%" : "3% (tanpa NPWP)"}`,
        persentase: tarif * 100,
        nominal: Math.round(dpp * tarif),
      });
    } else if (statusPkp) {
      catatan.push("PPh 22 juga tidak dipungut untuk transaksi barang di bawah Rp2.000.000.");
    } else {
      catatan.push(
        `Nilai transaksi (Rp${Math.round(dpp).toLocaleString("id-ID")}) di bawah Rp2.000.000 -- PPh 22 tidak dipungut.`
      );
    }
  } else if (bentukUsaha === "perseorangan") {
    // Jasa yang diberikan ORANG PRIBADI (perseorangan) BUKAN objek PPh 23
    // -- yang benar adalah PPh 21 Bukan Pegawai (PP 58/2023 & PMK
    // 168/2023), DPP-nya 50% dari penghasilan bruto, dikali tarif
    // progresif Pasal 17. Sama seperti PPh 23, tidak ada batas minimum
    // transaksi.
    const dppPph21 = dpp * 0.5;
    const tarif = adaNpwp ? TARIF.pph21BukanPegawaiLapisan1 : TARIF.pph21BukanPegawaiLapisan1 * 1.2;
    hasil.push({
      jenis_pajak: `PPh 21 Bukan Pegawai ${adaNpwp ? "5%" : "6% (tanpa NPWP)"} x 50% bruto`,
      persentase: tarif * 100,
      nominal: Math.round(dppPph21 * tarif),
    });
    catatan.push(
      "Penyedia berstatus Perseorangan (orang pribadi) -- dipotong PPh 21 Bukan Pegawai, BUKAN PPh 23. " +
        "Tarif 5%/6% di atas adalah lapisan pertama (estimasi transaksi ini saja); kalau orang yang sama " +
        "menerima pembayaran lain dalam tahun berjalan sehingga kumulatifnya tembus Rp60 juta, lapisan " +
        "tarifnya naik (15%/25%/dst) -- cek manual, aplikasi ini tidak melacak akumulasi antar pengajuan."
    );
  } else {
    // PPh 23 (jasa oleh BADAN USAHA): TIDAK ada batas minimum, selalu dipungut penuh.
    const tarif = adaNpwp ? TARIF.pph23 : TARIF.pph23TanpaNpwp;
    hasil.push({
      jenis_pajak: `PPh 23 ${adaNpwp ? "2%" : "4% (tanpa NPWP)"}`,
      persentase: tarif * 100,
      nominal: Math.round(dpp * tarif),
    });
  }

  return { hasil, catatan };
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
  const [metodePembayaran, setMetodePembayaran] = useState<"LS" | "GU">("GU");
  const [nomorNotaDinas, setNomorNotaDinas] = useState("");
  const [nomorBukti, setNomorBukti] = useState("");
  const [uraian, setUraian] = useState("");
  const [penyediaId, setPenyediaId] = useState("");
  const [namaPenerima, setNamaPenerima] = useState("");
  const [penerimaDiubahManual, setPenerimaDiubahManual] = useState(false);
  const [rincian, setRincian] = useState<Rincian[]>([{ nama_item: "", qty: 1, satuan: "", harga_satuan: 0 }]);
  const [potongan, setPotongan] = useState<Potongan[]>([]);
  const [catatanPajak, setCatatanPajak] = useState<string[]>([]);
  const [jenisPengadaan, setJenisPengadaan] = useState<JenisPengadaan>("barang");
  const [eKatalog, setEKatalog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: penyedia } = await supabase
        .from("penyedia")
        .select("id, nama_penyedia, nama_direktur, npwp, status_pkp, bentuk_usaha, pph_final_umkm")
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
            "id, dpa_id, tanggal, uraian_kegiatan, penyedia_id, nama_penerima, metode_pembayaran, nomor_nota_dinas, nomor_bukti, dpa:dpa(tahun_anggaran, tahapan)"
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
          setMetodePembayaran((existing as any).metode_pembayaran || "GU");
          setNomorNotaDinas((existing as any).nomor_nota_dinas || "");
          setNomorBukti((existing as any).nomor_bukti || "");

          const dpaPeriode = existing.dpa as any;
          setPeriode({ tahun: dpaPeriode?.tahun_anggaran, tahapan: dpaPeriode?.tahapan });

          const { data: dpa } = await supabase
            .from("dpa")
            .select(
              "id, tahapan, pagu_anggaran, pptk:pejabat_skpd(nama), rekening:rekening_belanja(kode_rekening, jenis_belanja, kelompok_belanja, sumber_dana, sub_kegiatan:sub_kegiatan(kode_sub_kegiatan, nama_sub_kegiatan, kegiatan:kegiatan(nama_kegiatan, program:program(nama_program))))"
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
            "id, tahapan, pagu_anggaran, pptk:pejabat_skpd(nama), rekening:rekening_belanja(kode_rekening, jenis_belanja, kelompok_belanja, sumber_dana, sub_kegiatan:sub_kegiatan(kode_sub_kegiatan, nama_sub_kegiatan, kegiatan:kegiatan(nama_kegiatan, program:program(nama_program))))"
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

  // Penyedia dipilih -> nama penerima kwitansi otomatis diisi dari Nama
  // Direktur/Penanggung Jawab (sesuai data Penyedia Barang/Jasa), selama
  // belum diubah manual oleh Bendahara.
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
    const { hasil, catatan } = hitungPajakOtomatis({
      totalBelanja,
      jenisPengadaan,
      statusPkp: Boolean(penyediaTerpilih?.status_pkp),
      adaNpwp: Boolean(penyediaTerpilih?.npwp),
      pakaiPphFinal: Boolean(penyediaTerpilih?.pph_final_umkm),
      bentukUsaha: (penyediaTerpilih?.bentuk_usaha as BentukUsaha) || "badan_usaha",
    });
    setPotongan(hasil);
    setCatatanPajak(catatan);
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
      metode_pembayaran: metodePembayaran,
      nomor_nota_dinas: nomorNotaDinas.trim() || null,
      nomor_bukti: nomorBukti.trim() || null,
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
        <p className="text-[11px] text-slate-400 uppercase tracking-wide -mb-1">
          Pilih rekening, lalu isi field di bawah ini secara manual
        </p>
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

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Metode Pembayaran</label>
            <select
              value={metodePembayaran}
              onChange={(e) => setMetodePembayaran(e.target.value as "LS" | "GU")}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none"
            >
              <option value="GU">GU (Ganti Uang)</option>
              <option value="LS">LS (Langsung)</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Menentukan teks "Pengajuan Pencairan {metodePembayaran}" di Nota Dinas & SPP/SPTJB.
              {metodePembayaran === "LS" && " Kwitansi GU tidak relevan untuk LS."}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Nomor Nota Dinas</label>
            <input
              type="text"
              value={nomorNotaDinas}
              onChange={(e) => setNomorNotaDinas(e.target.value)}
              placeholder={`${metodePembayaran === "LS" ? "935" : "934"}/___/35.79.121/${periode?.tahun ?? "2026"}`}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">Diisi manual sesuai buku agenda surat keluar.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Nomor Bukti (Kwitansi)</label>
            <input
              type="text"
              value={nomorBukti}
              onChange={(e) => setNomorBukti(e.target.value)}
              placeholder={`${metodePembayaran === "LS" ? "935" : "934"}/___/35.79.121/${periode?.tahun ?? "2026"}`}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">Diisi manual, boleh sama dengan Nomor Nota Dinas.</p>
          </div>
        </div>

        {dpaTerpilih && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-600 space-y-1.5">
            <p className="text-[11px] text-slate-400 uppercase tracking-wide">Data berikut otomatis dari Rekening &amp; Pagu (database) -- bukan isian manual</p>
            <p>
              <span className="text-slate-400">Program:</span>{" "}
              {dpaTerpilih.rekening?.sub_kegiatan?.kegiatan?.program?.nama_program || "-"}
            </p>
            <p>
              <span className="text-slate-400">Kegiatan:</span>{" "}
              {dpaTerpilih.rekening?.sub_kegiatan?.kegiatan?.nama_kegiatan || "-"}
            </p>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
              <p><span className="text-slate-400">Sub Kegiatan:</span> {dpaTerpilih.rekening?.sub_kegiatan?.nama_sub_kegiatan || "-"}</p>
              <p><span className="text-slate-400">Kode Rekening:</span> {dpaTerpilih.rekening?.kode_rekening || "-"}</p>
              <p><span className="text-slate-400">Jenis Belanja:</span> {dpaTerpilih.rekening?.kelompok_belanja || "-"}</p>
              <p><span className="text-slate-400">Sumber Dana:</span> {dpaTerpilih.rekening?.sumber_dana || "-"}</p>
              <p><span className="text-slate-400">PPTK:</span> {dpaTerpilih.pptk?.nama || "-- belum ditentukan di Rekening & Pagu --"}</p>
              <p><span className="text-slate-400">Pagu:</span> Rp {Number(dpaTerpilih.pagu_anggaran || 0).toLocaleString("id-ID")}</p>
            </div>
            {sisaAnggaran !== null && (
              <p>
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
            {penyediaTerpilih && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                  {penyediaTerpilih.bentuk_usaha === "perseorangan" ? "Perseorangan" : "Badan Usaha"}
                </span>
                <span className={`text-xs rounded-full px-2 py-0.5 ${penyediaTerpilih.status_pkp ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-500"}`}>
                  {penyediaTerpilih.status_pkp ? "PKP" : "Non-PKP"}
                </span>
                <span className={`text-xs rounded-full px-2 py-0.5 ${penyediaTerpilih.npwp ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                  {penyediaTerpilih.npwp ? "Ber-NPWP" : "Tanpa NPWP"}
                </span>
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Penerima</label>
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
              Otomatis terisi dari Nama Direktur/Penanggung Jawab saat memilih Penyedia -- bisa diketik ulang manual bila perlu.
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

        <div className="flex flex-wrap items-end gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3">
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
          <label className="flex items-center gap-1.5 text-xs text-slate-600 pb-2">
            <input type="checkbox" checked={eKatalog} onChange={(e) => setEKatalog(e.target.checked)} className="h-3.5 w-3.5" />
            Lewat E-Katalog/E-Purchasing LKPP
          </label>
          <button
            type="button"
            onClick={handleHitungOtomatis}
            className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xs font-medium rounded-lg px-3 py-2"
          >
            <Sparkles className="h-3.5 w-3.5" /> Hitung Otomatis
          </button>
          <p className="text-xs text-slate-400 flex-1 min-w-[220px]">
            Mengikuti PMK 51/2025 (PPh 22), PP 58/2023 &amp; PMK 168/2023 (PPh 21 Bukan Pegawai -- kalau
            Penyedia Perseorangan), PMK 141/2015 (PPh 23 -- kalau Penyedia Badan Usaha), status PKP/NPWP/
            Bentuk Penyedia di atas, dan PPh Final UMKM bila ditandai di data Penyedia. Alat bantu hitung,
            bukan nasihat pajak final -- Bendahara/PPK tetap wajib memverifikasi sebelum SPJ diajukan.
          </p>
        </div>

        {eKatalog && (
          <div className="flex items-start gap-2 text-xs text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 mb-3">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
              Lewat marketplace/ritel daring resmi LKPP (PMK 58/2022): marketplace itu sendiri yang DITUNJUK
              memungut &amp; menyetor PPN/PPh 22 -- <strong>kecuali</strong> kalau pembayarannya pakai mekanisme
              Pembayaran Langsung (LS), maka pemungutan tetap kembali ke Bendahara seperti biasa (perhitungan di
              bawah). Cek dulu invoice/faktur dari marketplace: kalau pajaknya sudah dipungut di sana, JANGAN
              tambahkan potongan lagi di sini (hindari pungutan ganda).
            </p>
          </div>
        )}

        {catatanPajak.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {catatanPajak.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <p>{c}</p>
              </div>
            ))}
          </div>
        )}

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
