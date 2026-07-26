-- =========================================================
-- Perbaikan presisi harga_satuan untuk kasus harga hasil
-- NEGOSIASI pengadaan barang/jasa.
--
-- Masalah di lapangan: negosiasi harga sering disepakati dalam bentuk
-- TOTAL (misal Rp1.000.000 untuk 7 unit), bukan per-unit. Kalau
-- harga_satuan cuma numeric(18,2) (2 desimal), maka:
--   Rp1.000.000 / 7 = Rp142.857,142857... dibulatkan ke Rp142.857,14
--   Rp142.857,14 x 7 = Rp999.999,98  <-- selisih Rp0,02 dari nilai
--                                         nego yang sebenarnya disepakati.
-- Selisih ini kecil per baris, tapi mengganggu rekonsiliasi ke
-- dokumen SPK/Kuitansi yang mengacu ke angka nego BULAT, dan bisa
-- berakumulasi kalau baris rincian banyak.
--
-- Solusi: naikkan presisi harga_satuan ke numeric(18,4) supaya
-- pembulatan baliknya jauh lebih halus (praktis tidak berpengaruh
-- setelah subtotal dibulatkan ke rupiah penuh). Kolom `subtotal`
-- (generated qty * harga_satuan) TETAP numeric(18,2) -- pembulatan
-- akhir ke rupiah penuh tetap terjadi di level subtotal per baris,
-- sesuai dokumen resmi (Rupiah tidak mengenal desimal).
--
-- Kolom qty & jumlah_pengajuan tidak diubah (tidak relevan dengan
-- masalah ini).
-- =========================================================

-- Postgres tidak mengizinkan ALTER TYPE pada kolom yang dipakai oleh
-- generated column lain -- makanya `subtotal` harus di-drop dulu,
-- baru dibuat ulang persis seperti semula setelah harga_satuan diubah.
alter table rincian_belanja drop column subtotal;

alter table rincian_belanja
  alter column harga_satuan type numeric(18,4);

alter table rincian_belanja
  add column subtotal numeric(18,2) generated always as (qty * harga_satuan) stored;
