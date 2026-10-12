-- =========================================================
-- Tambahan: flag "PPh Final UMKM (PP 23/2018)" di data Penyedia.
-- Dipakai kalkulator pajak otomatis di form Pengajuan Belanja -- kalau
-- penyedia sudah punya Surat Keterangan PP 23 (PPh Final 0,5%), maka
-- pemotongan PPh 22/23 normal TIDAK berlaku, diganti PPh Final 0,5%.
-- Defaultnya false (pakai skema normal) supaya tidak salah pilih.
-- =========================================================

alter table penyedia add column if not exists pph_final_umkm boolean not null default false;
