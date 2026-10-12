-- =========================================================
-- PERBAIKAN URAIAN REKENING 5.1.02.03.002.00035
-- =========================================================
-- Kode rekening ...5.1.02.03.002.00035 pada Sub Kegiatan
-- 4.01.01.2.09.0002 (Penyediaan Jasa Pemeliharaan, Biaya
-- Pemeliharaan, Pajak dan Perizinan Kendaraan Dinas Operasional
-- atau Lapangan) -- Kegiatan 4.01.01.2.09 (Pemeliharaan Barang
-- Milik Daerah Penunjang Urusan Pemerintahan Daerah) -- Program
-- 4.01.01 (Program Penunjang Urusan Pemerintahan Daerah
-- Kabupaten/Kota) -- SUDAH ADA di database (dimasukkan lewat
-- migrasi "20260716130000 import rekening dpa 2026.sql" &
-- direkonsiliasi ulang di "20260729000000_rekonsiliasi_kode_
-- rekening_lampiran_database.sql"), tetapi uraiannya masih
-- "Kendaraan Bermotor Penumpang".
--
-- Migrasi ini membetulkan uraian baris tsb menjadi sesuai
-- permintaan terbaru:
--   "Belanja Pemeliharaan Alat Angkutan-Alat Angkutan Darat
--    Bermotor-Kendaraan Dinas Bermotor Perorangan"
--
-- Karena kode_rekening bersifat unik per (sub_kegiatan_id,
-- sumber_dana), baris ini di-UPDATE (bukan dibuat baru) supaya
-- data DPA (pagu Murni & Pergeseran Rp33.600.000) dan
-- Pengajuan Belanja yang sudah terlanjur memakai baris ini
-- tetap terhubung dengan benar (rekening_id tidak berubah).
-- Idempotent -- aman dijalankan ulang.
-- =========================================================

update rekening_belanja rb
set jenis_belanja = 'Belanja Pemeliharaan Alat Angkutan-Alat Angkutan Darat Bermotor-Kendaraan Dinas Bermotor Perorangan'
from sub_kegiatan sk
where rb.sub_kegiatan_id = sk.id
  and sk.kode_sub_kegiatan = '4.01.01.2.09.0002'
  and sk.tahun_anggaran = 2026
  and rb.kode_rekening = '4.01.01.2.09.0002.5.1.02.03.002.00035'
  and rb.sumber_dana = 'PAD';

-- Jaga-jaga: kalau baris belum pernah ada sama sekali di suatu
-- lingkungan (mis. database baru yang belum pernah menjalankan
-- migrasi 20260716130000), buat barunya sekalian.
insert into rekening_belanja (sub_kegiatan_id, kode_rekening, jenis_belanja, kelompok_belanja, sumber_dana)
select sk.id,
       '4.01.01.2.09.0002.5.1.02.03.002.00035',
       'Belanja Pemeliharaan Alat Angkutan-Alat Angkutan Darat Bermotor-Kendaraan Dinas Bermotor Perorangan',
       'Belanja Barang/Jasa',
       'PAD'
from sub_kegiatan sk
where sk.kode_sub_kegiatan = '4.01.01.2.09.0002'
  and sk.tahun_anggaran = 2026
on conflict (sub_kegiatan_id, kode_rekening, sumber_dana) do update
set jenis_belanja = excluded.jenis_belanja;
