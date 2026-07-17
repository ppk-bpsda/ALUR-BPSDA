-- =========================================================
-- PERBAIKAN BUG: migrasi impor awal (20260716130000) salah menempatkan
-- data -- kolom `jenis_belanja` (NOT NULL, field utama yang ditampilkan
-- di seluruh aplikasi) diisi KATEGORI generik ("Belanja Operasi"/"Belanja
-- Modal") untuk SEMUA baris, sementara URAIAN SPESIFIK yang sesungguhnya
-- (mis. "Belanja Honorarium Penanggungjawaban Pengelola Keuangan",
-- sesuai kolom BELANJA di file lampiran) malah disimpan di `keterangan`
-- yang tidak pernah ditampilkan di UI manapun.
--
-- Akibatnya dropdown "Rekening/DPA" di Pengajuan Belanja dan tabel
-- Rekening & Pagu menampilkan "Belanja Operasi" untuk hampir semua baris
-- -- tidak informatif dan sulit dibedakan satu sama lain.
--
-- Perbaikan: tukar posisi -- `jenis_belanja` diisi uraian spesifik dari
-- `keterangan` (field utama, sesuai desain awal skema), `keterangan`
-- lama (kategori "Belanja Operasi"/"Belanja Modal") dipindah ke
-- `kelompok_belanja` yang sebelumnya kosong. Kolom `keterangan`
-- dikosongkan lagi supaya balik jadi field "catatan tambahan" bebas,
-- bukan tempat penyimpanan uraian utama.
-- =========================================================

update rekening_belanja
set
  kelompok_belanja = jenis_belanja,
  jenis_belanja = keterangan,
  keterangan = null
where keterangan is not null and keterangan <> '';
