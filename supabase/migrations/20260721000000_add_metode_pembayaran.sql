-- =========================================================
-- Dukungan metode pembayaran LS (Langsung) selain GU (Ganti Uang).
--
-- Sebelumnya jenis_pencairan di dokumen (Nota Dinas & SPP/SPTJB) selalu
-- di-hardcode "GU" di lib/dokumenData.ts. Sekarang setiap pengajuan
-- belanja punya kolom metode_pembayaran sendiri (LS atau GU), yang
-- menentukan teks "Pengajuan Pencairan LS/GU" di dokumen, dan format
-- nomor yang disarankan ke pengguna saat mengisi Nomor Nota Dinas /
-- Nomor Bukti secara manual:
--   LS = 935/nomor_dokumen/35.79.121/Tahun Anggaran
--   GU = 934/nomor_dokumen/35.79.121/Tahun Anggaran
--
-- Nomor dokumen (nomor_bukti, nomor_nota_dinas) TETAP diisi manual oleh
-- pengguna lewat form Pengajuan Belanja (bukan auto-number), karena
-- urutan nomor surat keluar diatur di luar aplikasi ini (buku agenda
-- surat Sekretariat Daerah).
-- =========================================================

alter table pengajuan_belanja
  add column if not exists metode_pembayaran text not null default 'GU'
  check (metode_pembayaran in ('LS', 'GU'));

comment on column pengajuan_belanja.metode_pembayaran is
  'Metode pencairan: LS (Langsung, nomor dokumen prefix 935) atau GU (Ganti Uang, prefix 934). Kwitansi GU hanya relevan untuk metode GU.';
