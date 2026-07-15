-- =========================================================
-- RESET (jalankan HANYA jika ini masih tahap setup awal, BELUM ada
-- data produksi yang ingin dipertahankan). Aman dijalankan berkali-
-- kali karena semua pakai "if exists".
-- =========================================================

drop view if exists rekap_realisasi cascade;

drop table if exists dokumen_output cascade;
drop table if exists potongan_pajak cascade;
drop table if exists rincian_belanja cascade;
drop table if exists pengajuan_belanja cascade;
drop table if exists dpa cascade;
drop table if exists penerima cascade;
drop table if exists penyedia cascade;
drop table if exists pptk cascade;
drop table if exists pejabat_skpd cascade;
drop table if exists rekening_belanja cascade;
drop table if exists sub_kegiatan cascade;
drop table if exists kegiatan cascade;
drop table if exists program cascade;

-- tabel v1 lama (kalau sempat ke-buat sebelumnya)
drop table if exists pegawai cascade;

drop type if exists jenis_dokumen cascade;
drop type if exists status_pengajuan cascade;
drop type if exists tahapan_dpa cascade;
drop type if exists jabatan_skpd cascade;
