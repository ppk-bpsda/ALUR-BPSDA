-- =========================================================
-- PERBAIKAN DATA SESUAI FILE "1. DATABASE" YANG SUDAH DIPERBAIKI (fixed-v18)
-- =========================================================
-- Dibandingkan baris per baris (52 baris) antara file DATABASE yang lama
-- (sumber migrasi 20260716130000) dengan file DATABASE yang baru/fixed --
-- ditemukan 4 jenis kesalahan berikut. Migrasi ini AMAN dijalankan ulang
-- (idempotent): setiap langkah dicek dulu apakah datanya masih dalam
-- kondisi "lama" sebelum diubah.
--
--  1) KODE REKENING salah pada 3 baris di Sub Kegiatan "Penyediaan
--     Administrasi Pelaksanaan Tugas ASN" (4.01.01.2.02.0002) -- dulu
--     memakai kode klasifikasi Honorarium (5.1.02.02.001.xxxxx), padahal
--     seharusnya:
--       - Belanja Honorarium Penanggungjawab Pengelola Keuangan
--         -> ...5.1.01.03.007.00001
--       - Belanja Honorarium Pengadaan Barang/Jasa
--         -> ...5.1.01.03.007.00002
--       - Belanja Jasa Pengelolaan BMD yang Tidak Menghasilkan Pendapatan
--         -> ...5.1.01.03.008.00002
--
--  2) SUB KEGIATAN salah pada 2 baris milik PPTK Diyah Wahyuni -- dulu
--     tercatat di kode sub kegiatan "duplikat" 4.01.03.2.01.0004 dan
--     4.01.03.2.01.0005 (catatan lama menyebut ini "3 kode berbeda utk
--     nama sub kegiatan yang sama" -- ternyata itu memang salah input,
--     bukan data asli), padahal seharusnya SEMUA di bawah
--     4.01.03.2.01.0003 ("Perencanaan dan Pengawasan Ekonomi Mikro Kecil"):
--       - Honorarium Narasumber/Pembahas/Moderator/dst (...00003)
--       - Belanja Jasa Penyelenggaraan Acara (...00047)
--
--  3) PAGU (murni & pergeseran) salah pada 3 baris PAD di Sub Kegiatan
--     "Koordinasi, Sinkronisasi dan Evaluasi Kebijakan Pertanian,
--     Kehutanan, Kelautan dan Perikanan" (4.01.03.2.04.0001) -- dulu
--     nilainya IKUT TERTUKAR sama dengan pasangan baris DBH CHT-nya:
--       - Makan Minum Rapat (PAD, ...00052): 8.135.000/8.860.000
--         -> seharusnya 5.812.500/5.812.500 (baris DBH CHT-nya TETAP
--         8.135.000/8.860.000, tidak berubah)
--       - Makan Minum Aktivitas Lapangan (PAD, ...00058): 0/1.237.500
--         -> seharusnya 3.300.000/3.300.000 (baris DBH CHT-nya TETAP
--         0/1.237.500, tidak berubah)
--       - Honorarium Narasumber dst (PAD, ...00003): 14.800.000/11.200.000
--         -> seharusnya 3.600.000/3.600.000 (baris DBH CHT-nya TETAP
--         14.800.000/11.200.000, tidak berubah)
--
--  4) NAMA BELANJA salah pada 1 baris (kode ...5.1.02.04.001.00003, sub
--     kegiatan 4.01.03.2.04.0001, PAD) -- dulu "Belanja Perjalanan Dinas
--     Paket Meeting Dalam Kota", seharusnya "Belanja Perjalanan Dinas
--     Dalam Kota".
--
-- CATATAN: perbaikan #3 MENGURANGI pagu di 3 baris tersebut. Kalau di
-- baris itu SUDAH ada Pengajuan Belanja yang tercatat, migrasi ini tetap
-- akan mengubah pagunya (sesuai konfirmasi data yang benar dari file
-- fixed-v18), TAPI akan memunculkan NOTICE supaya bisa dicek manual kalau
-- ternyata realisasi yang sudah berjalan sekarang melebihi pagu barunya.
-- =========================================================

-- ---------------------------------------------------------
-- 1) PERBAIKAN KODE REKENING (3 baris, sub kegiatan 4.01.01.2.02.0002)
-- ---------------------------------------------------------
update rekening_belanja
   set kode_rekening = '4.01.01.2.02.0002.5.1.01.03.007.00001'
 where kode_rekening = '4.01.01.2.02.0002.5.1.02.02.001.00080'
   and sumber_dana = 'PAD';

update rekening_belanja
   set kode_rekening = '4.01.01.2.02.0002.5.1.01.03.007.00002'
 where kode_rekening = '4.01.01.2.02.0002.5.1.02.02.001.00081'
   and sumber_dana = 'PAD';

update rekening_belanja
   set kode_rekening = '4.01.01.2.02.0002.5.1.01.03.008.00002'
 where kode_rekening = '4.01.01.2.02.0002.5.1.02.02.001.00001'
   and sumber_dana = 'PAD';

-- ---------------------------------------------------------
-- 2) PINDAHKAN 2 BARIS DARI SUB KEGIATAN 0004/0005 -> 0003
-- ---------------------------------------------------------
do $$
declare
  v_sub_0003_id uuid;
begin
  select id into v_sub_0003_id
  from sub_kegiatan
  where kode_sub_kegiatan = '4.01.03.2.01.0003' and tahun_anggaran = 2026;

  if v_sub_0003_id is null then
    raise notice 'Sub kegiatan 4.01.03.2.01.0003 (tahun 2026) tidak ditemukan -- langkah 2 dilewati, cek manual.';
  else
    update rekening_belanja
       set sub_kegiatan_id = v_sub_0003_id,
           kode_rekening = '4.01.03.2.01.0003.5.1.02.02.001.00003'
     where kode_rekening = '4.01.03.2.01.0004.5.1.02.02.001.00003'
       and sumber_dana = 'PAD';

    update rekening_belanja
       set sub_kegiatan_id = v_sub_0003_id,
           kode_rekening = '4.01.03.2.01.0003.5.1.02.02.001.00047'
     where kode_rekening = '4.01.03.2.01.0005.5.1.02.02.001.00047'
       and sumber_dana = 'PAD';
  end if;
end $$;

-- Selaraskan pptk_id pada dpa milik 2 baris yang baru dipindah di atas,
-- supaya menunjuk ke baris PPTK "Diyah Wahyuni" yang terikat ke sub
-- kegiatan 4.01.03.2.01.0003 (bukan lagi yang terikat ke 0004/0005).
do $$
declare
  v_pptk_0003_id uuid;
begin
  select ps.id into v_pptk_0003_id
  from pejabat_skpd ps
  join sub_kegiatan sk on sk.id = ps.sub_kegiatan_id
  where ps.jabatan = 'PPTK'
    and ps.nama = 'Diyah Wahyuni'
    and sk.kode_sub_kegiatan = '4.01.03.2.01.0003'
    and sk.tahun_anggaran = 2026
  limit 1;

  if v_pptk_0003_id is null then
    raise notice 'Baris PPTK Diyah Wahyuni untuk sub kegiatan 0003 tidak ditemukan -- pptk_id pada dpa TIDAK disesuaikan, cek manual di menu Manajemen Akun/Pejabat.';
  else
    update dpa d
       set pptk_id = v_pptk_0003_id
      from rekening_belanja rb
     where d.rekening_id = rb.id
       and rb.kode_rekening in (
         '4.01.03.2.01.0003.5.1.02.02.001.00003',
         '4.01.03.2.01.0003.5.1.02.02.001.00047'
       )
       and rb.sumber_dana = 'PAD';
  end if;
end $$;

-- ---------------------------------------------------------
-- 3) PERBAIKAN PAGU MURNI & PERGESERAN (3 baris PAD, sub 4.01.03.2.04.0001)
-- ---------------------------------------------------------
do $$
declare
  v_terpakai int;
begin
  -- Makan Minum Rapat (PAD)
  select count(*) into v_terpakai
  from pengajuan_belanja p
  join dpa d on d.id = p.dpa_id
  join rekening_belanja rb on rb.id = d.rekening_id
  where rb.kode_rekening = '4.01.03.2.04.0001.5.1.02.01.001.00052' and rb.sumber_dana = 'PAD';
  if v_terpakai > 0 then
    raise notice 'Rekening Makan Minum Rapat (PAD, 4.01.03.2.04.0001) sudah punya % Pengajuan Belanja -- pagu tetap diperbaiki, cek manual apakah realisasi masih di bawah pagu baru.', v_terpakai;
  end if;

  update dpa d
     set pagu_anggaran = 5812500
    from rekening_belanja rb
   where d.rekening_id = rb.id
     and rb.kode_rekening = '4.01.03.2.04.0001.5.1.02.01.001.00052'
     and rb.sumber_dana = 'PAD'
     and d.tahapan in ('murni', 'pergeseran');

  -- Makan Minum Aktivitas Lapangan (PAD)
  select count(*) into v_terpakai
  from pengajuan_belanja p
  join dpa d on d.id = p.dpa_id
  join rekening_belanja rb on rb.id = d.rekening_id
  where rb.kode_rekening = '4.01.03.2.04.0001.5.1.02.01.001.00058' and rb.sumber_dana = 'PAD';
  if v_terpakai > 0 then
    raise notice 'Rekening Makan Minum Aktivitas Lapangan (PAD, 4.01.03.2.04.0001) sudah punya % Pengajuan Belanja -- pagu tetap diperbaiki, cek manual apakah realisasi masih di bawah pagu baru.', v_terpakai;
  end if;

  update dpa d
     set pagu_anggaran = 3300000
    from rekening_belanja rb
   where d.rekening_id = rb.id
     and rb.kode_rekening = '4.01.03.2.04.0001.5.1.02.01.001.00058'
     and rb.sumber_dana = 'PAD'
     and d.tahapan in ('murni', 'pergeseran');

  -- Honorarium Narasumber dst (PAD)
  select count(*) into v_terpakai
  from pengajuan_belanja p
  join dpa d on d.id = p.dpa_id
  join rekening_belanja rb on rb.id = d.rekening_id
  where rb.kode_rekening = '4.01.03.2.04.0001.5.1.02.02.001.00003' and rb.sumber_dana = 'PAD';
  if v_terpakai > 0 then
    raise notice 'Rekening Honorarium Narasumber dst (PAD, 4.01.03.2.04.0001) sudah punya % Pengajuan Belanja -- pagu tetap diperbaiki, cek manual apakah realisasi masih di bawah pagu baru.', v_terpakai;
  end if;

  update dpa d
     set pagu_anggaran = 3600000
    from rekening_belanja rb
   where d.rekening_id = rb.id
     and rb.kode_rekening = '4.01.03.2.04.0001.5.1.02.02.001.00003'
     and rb.sumber_dana = 'PAD'
     and d.tahapan in ('murni', 'pergeseran');
end $$;

-- ---------------------------------------------------------
-- 4) PERBAIKAN NAMA BELANJA (1 baris)
-- ---------------------------------------------------------
update rekening_belanja
   set keterangan = 'Belanja Perjalanan Dinas Dalam Kota'
 where kode_rekening = '4.01.03.2.04.0001.5.1.02.04.001.00003'
   and sumber_dana = 'PAD'
   and keterangan = 'Belanja Perjalanan Dinas Paket Meeting Dalam Kota';
