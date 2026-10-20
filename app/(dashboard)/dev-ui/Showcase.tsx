"use client";

import { useState } from "react";
import { FileText, Inbox, Plus, Search, Trash2 } from "lucide-react";
import {
  Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, IconButton, Input, Modal, PageHeader,
  Pagination, Select, Skeleton, Spinner, StatusBadge, Table, TableWrap, Tabs, Td, Textarea, Th, Tooltip, useToast,
} from "@/components/ui";

const SWATCHES: Array<[string, string]> = [
  ["brand-600", "bg-brand-600"], ["brand-100", "bg-brand-100"], ["ink-900", "bg-ink-900"],
  ["accent-400", "bg-accent-400"], ["canvas", "bg-canvas border border-line"],
  ["success-600", "bg-success-600"], ["warning-600", "bg-warning-600"], ["danger-600", "bg-danger-600"], ["info-600", "bg-info-600"],
];

const rupiah = new Intl.NumberFormat("id-ID");

export default function Showcase() {
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingBtn, setLoadingBtn] = useState(false);

  function fakeDelete() {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setConfirm(false);
      toast.success("Pengajuan dihapus.");
    }, 900);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-8">
      <PageHeader
        title="Rujukan komponen UI"
        description="Halaman internal untuk melihat semua komponen dasar. Tidak tampil di produksi."
        breadcrumbs={[{ label: "Beranda", href: "/" }, { label: "Komponen UI" }]}
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>Pengajuan baru</Button>}
      />

      <Card>
        <CardHeader title="Warna & tipografi" description="Token dari tailwind.config.ts." />
        <div className="flex flex-wrap gap-3">
          {SWATCHES.map(([name, cls]) => (
            <div key={name} className="w-24">
              <div className={`h-12 rounded-ctl ${cls}`} />
              <p className="mt-1 text-caption text-slate-500">{name}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-1">
          <p className="text-display text-ink-900">Realisasi anggaran</p>
          <p className="text-title text-ink-900">Rp {rupiah.format(1250000000)}</p>
          <p className="text-heading text-ink-900">Ringkasan per rekening</p>
          <p className="text-body text-slate-600">Teks isi: 0123456789, angka tabular untuk kolom Rupiah.</p>
          <p className="text-caption text-slate-500">Keterangan kecil dan catatan bantu.</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Tombol & badge" />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Simpan</Button>
          <Button variant="accent">Buat SPJ</Button>
          <Button variant="secondary">Batal</Button>
          <Button variant="ghost">Lihat detail</Button>
          <Button variant="danger" leftIcon={<Trash2 className="h-4 w-4" />}>Hapus</Button>
          <Button variant="danger-solid">Hapus permanen</Button>
          <Button variant="primary" size="sm">Kecil</Button>
          <Button variant="primary" size="lg">Besar</Button>
          <Button
            variant="primary"
            loading={loadingBtn}
            onClick={() => { setLoadingBtn(true); setTimeout(() => setLoadingBtn(false), 1500); }}
          >
            Menyimpan…
          </Button>
          <Button variant="primary" disabled>Nonaktif</Button>
          <Tooltip text="Cari pengajuan"><IconButton label="Cari" icon={<Search className="h-4 w-4" />} variant="secondary" /></Tooltip>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {["draft", "diajukan", "disetujui", "dicairkan", "ditolak"].map((s) => <StatusBadge key={s} status={s} />)}
          <Badge tone="brand">TA 2026</Badge>
          <Badge tone="accent">Baru</Badge>
          <Spinner label="Memuat" className="h-5 w-5 text-brand-600" />
        </div>
      </Card>

      <Card>
        <CardHeader title="Isian formulir" description="Label, bantuan, dan galat terhubung ke input lewat aria." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nomor pengajuan" placeholder="mis. 001/ND/2026" hint="Format bebas." required />
          <Input label="Nominal" leading="Rp" inputMode="numeric" defaultValue="1500000" />
          <Input label="Tanggal" type="date" error="Tanggal tidak boleh melewati akhir tahapan." defaultValue="2027-01-01" />
          <Select label="Status" defaultValue="draft">
            <option value="draft">Draft</option>
            <option value="diajukan">Diajukan</option>
          </Select>
          <Textarea label="Uraian" wrapperClassName="sm:col-span-2" placeholder="Tuliskan uraian belanja…" />
        </div>
      </Card>

      <Card padded={false}>
        <div className="p-5 pb-0 sm:p-6 sm:pb-0"><CardHeader title="Tabel" description="Angka rata kanan, kolom bisa digulir di layar kecil." /></div>
        <TableWrap label="Contoh tabel pengajuan" className="rounded-none border-0 shadow-none">
          <Table caption="Contoh tabel pengajuan">
            <thead>
              <tr><Th>Nomor</Th><Th>Uraian</Th><Th numeric>Nilai (Rp)</Th><Th>Status</Th></tr>
            </thead>
            <tbody>
              {[
                ["001/ND/2026", "Belanja alat tulis kantor", 2450000, "disetujui"],
                ["002/ND/2026", "Belanja jasa konsumsi rapat", 12800000, "diajukan"],
                ["003/ND/2026", "Perjalanan dinas dalam daerah", 7350000, "draft"],
              ].map(([no, uraian, nilai, st]) => (
                <tr key={no as string}>
                  <Td className="font-medium text-ink-900">{no}</Td>
                  <Td>{uraian}</Td>
                  <Td numeric>{rupiah.format(nilai as number)}</Td>
                  <Td><StatusBadge status={st as string} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        <div className="p-4"><Pagination page={3} totalPages={9} hrefFor={(p) => `#halaman-${p}`} /></div>
      </Card>

      <Card>
        <CardHeader title="Tab" />
        <Tabs
          label="Contoh tab laporan"
          items={[
            { id: "a", label: "Per rekening", count: 12, content: <p className="text-body text-slate-600">Isi tab pertama.</p> },
            { id: "b", label: "Per kegiatan", count: 4, content: <p className="text-body text-slate-600">Isi tab kedua.</p> },
            { id: "c", label: "Per bulan", content: <p className="text-body text-slate-600">Isi tab ketiga.</p> },
          ]}
        />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader title="Keadaan kosong" />
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title="Belum ada pengajuan"
            description="Buat pengajuan pertama untuk mulai menyusun SPJ."
            action={<Button variant="primary" leftIcon={<FileText className="h-4 w-4" />}>Buat pengajuan</Button>}
          />
        </Card>
        <Card>
          <CardHeader title="Skeleton" />
          <div className="space-y-3"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-24 w-full" /></div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Dialog & notifikasi" description="Pengganti confirm() dan alert()." />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setModal(true)}>Buka dialog</Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>Hapus pengajuan…</Button>
          <Button variant="secondary" onClick={() => toast.success("Perubahan disimpan.")}>Toast sukses</Button>
          <Button variant="secondary" onClick={() => toast.error("Status tidak berubah. Periksa koneksi lalu coba lagi.", { title: "Gagal menyimpan" })}>Toast galat</Button>
          <Button variant="secondary" onClick={() => toast.warning("Total potongan melebihi nilai belanja.")}>Toast peringatan</Button>
          <Button variant="secondary" onClick={() => toast.info("Periode aktif: TA 2026, Tahap 2.")}>Toast info</Button>
        </div>
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Ubah nama pejabat"
        description="Perubahan langsung dipakai di dokumen berikutnya."
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Batal</Button><Button variant="primary" onClick={() => { setModal(false); toast.success("Pejabat diperbarui."); }}>Simpan perubahan</Button></>}
      >
        <Input label="Nama lengkap" defaultValue="Contoh Nama, S.E." />
      </Modal>

      <ConfirmDialog
        open={confirm}
        tone="danger"
        loading={busy}
        title="Hapus pengajuan ini?"
        description="Rincian dan potongan ikut terhapus dan tidak bisa dikembalikan."
        confirmLabel="Hapus pengajuan"
        onConfirm={fakeDelete}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
