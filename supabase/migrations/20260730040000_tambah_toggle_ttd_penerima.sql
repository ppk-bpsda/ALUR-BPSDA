-- Toggle eksplisit untuk blok tanda tangan "Penerima" pada Kuitansi.
--
-- Sebelumnya blok ini otomatis tampil/hilang HANYA berdasarkan terisi
-- tidaknya field `nama_penerima` (kosong = blok tidak dicetak). Itu
-- cukup untuk kasus umum, tapi tidak mengakomodasi kasus di mana nama
-- penerima tetap ingin disimpan di data (mis. untuk riwayat/laporan)
-- namun blok tanda tangannya TIDAK ingin dicetak di Kuitansi, atau
-- sebaliknya. Kolom ini memisahkan dua hal tersebut sebagai opsi
-- eksplisit pada Form Pengajuan Belanja Baru, default TRUE supaya
-- perilaku pengajuan yang sudah ada tidak berubah.
--
-- Catatan penomoran: file ini semula bernama
-- 20260730000000_tambah_toggle_ttd_penerima.sql, tapi nomor itu sudah
-- dipakai migrasi lain ("hapus duplikat paket meeting dalam kota") --
-- diganti ke 20260730040000 (setelah migrasi 20260730030000 yang sudah
-- ada) supaya tidak bentrok.
alter table pengajuan_belanja
  add column if not exists cetak_ttd_penerima boolean not null default true;
