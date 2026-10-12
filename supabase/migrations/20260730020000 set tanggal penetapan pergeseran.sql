-- =========================================================
-- Isi dpa.tanggal_penetapan untuk semua baris DPA tahapan "pergeseran"
-- tahun 2026 yang belum punya tanggal (idempotent -- tidak menimpa yang
-- sudah terisi). Kolom ini SEKARANG dipakai oleh form Pengajuan Belanja
-- untuk menentukan otomatis tahapan mana yang berlaku untuk satu
-- transaksi, berdasarkan tanggal transaksi vs tanggal DPA
-- Pergeseran/Perubahan ditetapkan -- BUKAN lagi dari periode aktif yang
-- sedang dipilih pegawai saat input.
--
-- Sesuai keterangan: DPA Pergeseran ditetapkan 16 Maret 2026 --
-- transaksi bertanggal SEBELUM itu = tahapan Murni, transaksi bertanggal
-- 16 Maret 2026 atau setelahnya = tahapan Pergeseran.
--
-- CATATAN: kalau nanti ada DPA Perubahan, jalankan migrasi serupa untuk
-- tahapan 'perubahan' dengan tanggal penetapannya masing-masing.
-- =========================================================

update dpa
set tanggal_penetapan = '2026-03-16'
where tahun_anggaran = 2026
  and tahapan = 'pergeseran'
  and tanggal_penetapan is null;
