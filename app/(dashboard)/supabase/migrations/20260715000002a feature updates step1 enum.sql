-- =========================================================
-- STEP 1 dari 2 -- HARUS dijalankan (Run) SENDIRIAN, terpisah dari step 2.
-- PostgreSQL tidak mengizinkan nilai enum baru dipakai di transaksi yang
-- sama dengan saat ia ditambahkan (ERROR 55P04: unsafe use of new value).
-- Jalankan file ini dulu, tunggu sampai sukses, BARU jalankan step 2.
-- =========================================================

alter type jabatan_skpd add value if not exists 'PPTK';
