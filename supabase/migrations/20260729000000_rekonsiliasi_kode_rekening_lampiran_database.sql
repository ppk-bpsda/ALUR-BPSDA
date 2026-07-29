-- =========================================================
-- REKONSILIASI kode_rekening & jenis_belanja terhadap lampiran
-- "1__DATABASE.pdf" (sumber resmi/terbaru dari Bagian Perekonomian
-- dan SDA) -- untuk Program 4.01.01 (Penunjang Urusan Pemerintahan)
-- & 4.01.03 (Perekonomian dan Pembangunan), tahun anggaran 2026.
--
-- LATAR BELAKANG BUG:
-- Migrasi impor "20260716130000 import rekening dpa 2026.sql" salah
-- memasukkan kode rekening belanja (19 karakter terakhir dari kode
-- rekening lengkap) untuk banyak baris -- nomor urutnya TIDAK sesuai
-- file sumber (mis. Honorarium Penanggungjawaban Pengelola Keuangan
-- tersimpan dengan kode rekening ...00080, padahal seharusnya
-- ...00001 sesuai lampiran). Migrasi cleanup duplikat sebelumnya
-- (20260724010000 & 20260725000000) hanya membetulkan SATU akun
-- (Belanja Jasa Tenaga Kebersihan, ...00030 -- kebetulan sudah benar)
-- dan tidak menyentuh kesalahan nomor rekening pada baris-baris lain.
--
-- Migrasi ini MENGACU LANGSUNG ke lampiran "1__DATABASE.pdf" sebagai
-- kebenaran, dicocokkan berdasarkan ISI (kode sub kegiatan + sumber
-- dana + uraian jenis_belanja -- BUKAN kode rekening lama yang salah),
-- lalu:
--   1) Kalau baris dengan uraian yang sama sudah ada tapi kode
--      rekeningnya beda dari lampiran -> kode rekening dibetulkan.
--   2) Kalau pembetulan itu akan bentrok dengan baris lain yang sudah
--      lebih dulu memakai kode rekening yang benar (skenario duplikat
--      lama) -> data pagu (DPA) & pengajuan yang sudah terlanjur
--      dibuat di baris duplikat DIPINDAHKAN ke baris yang benar
--      (dijumlah per tahapan), baris duplikat baru dihapus.
--   3) Kalau baris dengan uraian itu belum ada sama sekali (hilang
--      dari data saat ini) -> dibuat baru lengkap dengan DPA tahapan
--      MURNI & PERGESERAN sesuai nominal di lampiran.
-- Semua langkah idempotent (aman dijalankan ulang).
--
-- CATATAN: baris "Belanja Perjalanan Dinas Paket Meeting Dalam Kota"
-- (kode ...5.1.02.04.001.00003) pada Sub Kegiatan Koordinasi,
-- Sinkronisasi dan Evaluasi Kebijakan Pertanian, Kehutanan, Kelautan
-- dan Perikanan TIDAK ADA di lampiran "1__DATABASE.pdf" -- kemungkinan
-- salah input kode rekening (seharusnya "Belanja Perjalanan Dinas
-- Dalam Kota", kode ...00004, sudah dibuatkan baris barunya oleh
-- migrasi ini). Baris lama TIDAK otomatis dihapus supaya tidak ada
-- data hilang tanpa sepengetahuan Admin -- baris ini hanya dihapus di
-- bagian paling akhir migrasi JIKA belum pernah dipakai (belum ada
-- Pengajuan Belanja apa pun di atasnya); kalau sudah pernah dipakai,
-- migrasi akan raise notice supaya Admin pindahkan manual dulu.
-- =========================================================

do $$
declare
  rec record;
  v_sub_id uuid;
  v_pptk_id uuid;
  v_content_row_id uuid;      -- rekening_belanja yg cocok isinya (jenis_belanja)
  v_content_kode text;
  v_target_kode text;
  v_collision_row_id uuid;    -- rekening_belanja lain yg SUDAH pakai target_kode
  v_dpa_src record;
  v_dpa_dst_id uuid;
  v_new_rekening_id uuid;
  v_total_dibetulkan int := 0;
  v_total_digabung int := 0;
  v_total_dibuat_baru int := 0;
begin
  for rec in
    select * from (values
  ('4.01.01.2.02.0002', 'PAD', 'Belanja Honorarium Penanggungjawaban Pengelola Keuangan', '5.1.01.03.007.00001', 59220000::numeric, 59220000::numeric),
  ('4.01.01.2.02.0002', 'PAD', 'Belanja Honorarium Pengadaan Barang/Jasa', '5.1.01.03.007.00002', 8160000::numeric, 8160000::numeric),
  ('4.01.01.2.02.0002', 'PAD', 'Belanja Jasa Pengelolaan BMD yang Tidak Menghasilkan Pendapatan', '5.1.01.03.008.00002', 3600000::numeric, 3600000::numeric),
  ('4.01.01.2.05.0009', 'PAD', 'Kontribusi Kursus Singkat/ Pelatihan/ Sosialisasi/ Bimtek/ Diklat', '5.1.02.02.012.00001', 15000000::numeric, 15000000::numeric),
  ('4.01.01.2.06.0002', 'PAD', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor', '5.1.02.01.001.00024', 1766099::numeric, 4456499::numeric),
  ('4.01.01.2.06.0002', 'PAD', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Kertas dan Cover', '5.1.02.01.001.00025', 6524100::numeric, 6619040::numeric),
  ('4.01.01.2.06.0002', 'PAD', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Benda Pos', '5.1.02.01.001.00027', 1170000::numeric, 1170000::numeric),
  ('4.01.01.2.06.0002', 'PAD', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Bahan Komputer', '5.1.02.01.001.00029', 4153340::numeric, 1434000::numeric),
  ('4.01.01.2.06.0002', 'PAD', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Listrik', '5.1.02.01.001.00031', 379200::numeric, 313200::numeric),
  ('4.01.01.2.06.0002', 'PAD', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Alat/Bahan untuk Kegiatan Kantor Lainnya', '5.1.02.01.001.00036', 3250000::numeric, 3250000::numeric),
  ('4.01.01.2.06.0003', 'PAD', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Perabot Kantor', '5.1.02.01.001.00030', 4183600::numeric, 4183600::numeric),
  ('4.01.01.2.06.0003', 'PAD', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Alat/Bahan untuk Kegiatan Kantor Lainnya', '5.1.02.01.001.00036', 0::numeric, 0::numeric),
  ('4.01.01.2.06.0004', 'PAD', 'Belanja Makanan dan Minuman Aktivitas Lapangan', '5.1.02.01.001.00058', 5480000::numeric, 5480000::numeric),
  ('4.01.01.2.06.0009', 'PAD', 'Belanja Makanan dan Minuman Rapat', '5.1.02.01.001.00052', 1320000::numeric, 1320000::numeric),
  ('4.01.01.2.06.0009', 'PAD', 'Belanja Perjalanan Dinas Biasa', '5.1.02.04.001.00001', 36068000::numeric, 36068000::numeric),
  ('4.01.01.2.07.0006', 'PAD', 'Belanja Modal Alat Penyimpan Perlengkapan Kantor', '5.2.02.05.001.00004', 8348800::numeric, 8348800::numeric),
  ('4.01.01.2.08.0004', 'PAD', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor', '5.1.02.01.001.00024', 0::numeric, 329052::numeric),
  ('4.01.01.2.08.0004', 'PAD', 'Belanja Jasa Tenaga Kebersihan', '5.1.02.02.001.00030', 32429052::numeric, 32100000::numeric),
  ('4.01.01.2.09.0002', 'PAD', 'Belanja Pembayaran Pajak, Bea, dan Perizinan', '5.1.02.02.001.00067', 7150000::numeric, 7150000::numeric),
  ('4.01.01.2.09.0002', 'PAD', 'Belanja Pemeliharaan Alat Angkutan-Alat Angkutan Darat Bermotor-Kendaraan Bermotor Penumpang', '5.1.02.03.002.00035', 33600000::numeric, 33600000::numeric),
  ('4.01.01.2.09.0002', 'PAD', 'Belanja Pemeliharaan Alat Angkutan-Alat Angkutan Darat Bermotor-Kendaraan Bermotor Beroda Dua', '5.1.02.03.002.00038', 29200000::numeric, 29200000::numeric),
  ('4.01.01.2.09.0006', 'PAD', 'Belanja Pemeliharaan Komputer-Komputer Unit-Personal Computer', '5.1.02.03.002.00405', 2190000::numeric, 2190000::numeric),
  ('4.01.01.2.09.0006', 'PAD', 'Belanja Pemeliharaan Komputer-Peralatan Komputer-Peralatan Personal Computer', '5.1.02.03.002.00409', 1380000::numeric, 1380000::numeric),
  ('4.01.03.2.01.0001', 'PAD', 'Belanja Makanan dan Minuman Rapat', '5.1.02.01.001.00052', 20112500::numeric, 14412500::numeric),
  ('4.01.03.2.01.0001', 'PAD', 'Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia', '5.1.02.02.001.00003', 80000000::numeric, 65100000::numeric),
  ('4.01.03.2.01.0001', 'PAD', 'Honorarium Tim Pelaksana Kegiatan dan Sekretariat Tim Pelaksana Kegiatan', '5.1.02.02.001.00004', 7100000::numeric, 14200000::numeric),
  ('4.01.03.2.01.0001', 'PAD', 'Belanja Sewa Hotel', '5.1.02.02.005.00043', 4500000::numeric, 6000000::numeric),
  ('4.01.03.2.01.0001', 'PAD', 'Belanja Jasa Konsultansi Berorientasi Layanan-Jasa Khusus', '5.1.02.02.009.00014', 55000000::numeric, 55000000::numeric),
  ('4.01.03.2.01.0001', 'PAD', 'Kontribusi Kursus Singkat/ Pelatihan/ Sosialisasi/ Bimtek/ Diklat', '5.1.02.02.012.00001', 5000000::numeric, 17000000::numeric),
  ('4.01.03.2.01.0002', 'PAD', 'Belanja Makanan dan Minuman Rapat', '5.1.02.01.001.00052', 34680000::numeric, 34680000::numeric),
  ('4.01.03.2.01.0002', 'PAD', 'Belanja Makanan dan Minuman Aktivitas Lapangan', '5.1.02.01.001.00058', 3300000::numeric, 3300000::numeric),
  ('4.01.03.2.01.0002', 'PAD', 'Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia', '5.1.02.02.001.00003', 13100000::numeric, 13100000::numeric),
  ('4.01.03.2.01.0002', 'PAD', 'Honorarium Tim Pelaksana Kegiatan dan Sekretariat Tim Pelaksana Kegiatan', '5.1.02.02.001.00004', 0::numeric, 0::numeric),
  ('4.01.03.2.01.0002', 'PAD', 'Belanja Jasa Penyelenggaraan Acara', '5.1.02.02.001.00047', 50000000::numeric, 50000000::numeric),
  ('4.01.03.2.01.0003', 'PAD', 'Belanja Makanan dan Minuman Rapat', '5.1.02.01.001.00052', 21000000::numeric, 10200000::numeric),
  ('4.01.03.2.01.0003', 'PAD', 'Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia', '5.1.02.02.001.00003', 5200000::numeric, 16000000::numeric),
  ('4.01.03.2.01.0003', 'PAD', 'Belanja Jasa Penyelenggaraan Acara', '5.1.02.02.001.00047', 50000000::numeric, 50000000::numeric),
  ('4.01.03.2.04.0001', 'DBH CHT', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor (DBH CHT)', '5.1.02.01.001.00024', 2500::numeric, 0::numeric),
  ('4.01.03.2.04.0001', 'PAD', 'Belanja Makanan dan Minuman Rapat', '5.1.02.01.001.00052', 5812500::numeric, 5812500::numeric),
  ('4.01.03.2.04.0001', 'DBH CHT', 'Belanja Makanan dan Minuman Rapat (DBH CHT)', '5.1.02.01.001.00052', 8135000::numeric, 8860000::numeric),
  ('4.01.03.2.04.0001', 'PAD', 'Belanja Makanan dan Minuman Aktivitas Lapangan', '5.1.02.01.001.00058', 3300000::numeric, 3300000::numeric),
  ('4.01.03.2.04.0001', 'DBH CHT', 'Belanja Makanan dan Minuman Aktivitas Lapangan', '5.1.02.01.001.00058', 0::numeric, 1237500::numeric),
  ('4.01.03.2.04.0001', 'PAD', 'Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia', '5.1.02.02.001.00003', 3600000::numeric, 3600000::numeric),
  ('4.01.03.2.04.0001', 'DBH CHT', 'Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia (DBH CHT)', '5.1.02.02.001.00003', 14800000::numeric, 11200000::numeric),
  ('4.01.03.2.04.0001', 'DBH CHT', 'Belanja Perjalanan Dinas Biasa (DBH CHT)', '5.1.02.04.001.00001', 16400000::numeric, 18040000::numeric),
  ('4.01.03.2.04.0001', 'PAD', 'Belanja Perjalanan Dinas Dalam Kota', '5.1.02.04.001.00004', 5000000::numeric, 5000000::numeric),
  ('4.01.03.2.04.0002', 'PAD', 'Belanja Makanan dan Minuman Rapat', '5.1.02.01.001.00052', 2625000::numeric, 2625000::numeric),
  ('4.01.03.2.04.0002', 'PAD', 'Belanja Makanan dan Minuman Aktivitas Lapangan', '5.1.02.01.001.00058', 2750000::numeric, 2750000::numeric),
  ('4.01.03.2.04.0002', 'PAD', 'Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia', '5.1.02.02.001.00003', 0::numeric, 0::numeric),
  ('4.01.03.2.04.0003', 'PAD', 'Belanja Makanan dan Minuman Rapat', '5.1.02.01.001.00052', 2700000::numeric, 2700000::numeric),
  ('4.01.03.2.04.0003', 'PAD', 'Belanja Makanan dan Minuman Aktivitas Lapangan', '5.1.02.01.001.00058', 3300000::numeric, 3300000::numeric),
  ('4.01.03.2.04.0003', 'PAD', 'Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia', '5.1.02.02.001.00003', 0::numeric, 0::numeric)
    ) as v(sub_kode, sumber_dana, jenis_belanja, rek_kode, murni, pergeseran)
  loop
    select id into v_sub_id from sub_kegiatan
      where kode_sub_kegiatan = rec.sub_kode and tahun_anggaran = 2026;
    if v_sub_id is null then
      raise notice 'LEWATI: sub_kegiatan % tidak ditemukan.', rec.sub_kode;
      continue;
    end if;

    select pp.id into v_pptk_id from pptk pp
      where pp.sub_kegiatan_id = v_sub_id and pp.tahun_anggaran = 2026 limit 1;

    v_target_kode := rec.sub_kode || '.' || rec.rek_kode;

    -- cari baris yang isinya (uraian) cocok, walau kode rekeningnya salah
    select id, kode_rekening into v_content_row_id, v_content_kode
      from rekening_belanja
      where sub_kegiatan_id = v_sub_id
        and sumber_dana = rec.sumber_dana
        and lower(trim(jenis_belanja)) = lower(trim(rec.jenis_belanja))
      limit 1;

    if v_content_row_id is not null then
      if v_content_kode = v_target_kode then
        -- sudah benar, tidak ada yang perlu dilakukan
        continue;
      end if;

      -- cek tabrakan: apakah sudah ada baris LAIN yang kode rekeningnya
      -- persis kode yang benar (sisa duplikat lama)
      select id into v_collision_row_id from rekening_belanja
        where sub_kegiatan_id = v_sub_id
          and sumber_dana = rec.sumber_dana
          and kode_rekening = v_target_kode
          and id <> v_content_row_id;

      if v_collision_row_id is not null then
        -- gabungkan: pindahkan DPA & pengajuan dari v_content_row_id ke v_collision_row_id
        for v_dpa_src in select * from dpa where rekening_id = v_content_row_id loop
          select id into v_dpa_dst_id from dpa
            where rekening_id = v_collision_row_id and tahapan = v_dpa_src.tahapan;
          if v_dpa_dst_id is null then
            insert into dpa (rekening_id, tahun_anggaran, tahapan, pagu_anggaran, nomor_dpa, tanggal_penetapan, pptk_id)
              values (v_collision_row_id, v_dpa_src.tahun_anggaran, v_dpa_src.tahapan, v_dpa_src.pagu_anggaran, v_dpa_src.nomor_dpa, v_dpa_src.tanggal_penetapan, v_dpa_src.pptk_id)
              returning id into v_dpa_dst_id;
          else
            update dpa set pagu_anggaran = pagu_anggaran + v_dpa_src.pagu_anggaran
              where id = v_dpa_dst_id;
          end if;
          update pengajuan_belanja set dpa_id = v_dpa_dst_id where dpa_id = v_dpa_src.id;
          delete from dpa where id = v_dpa_src.id;
        end loop;
        update rekening_belanja set jenis_belanja = rec.jenis_belanja where id = v_collision_row_id;
        delete from rekening_belanja where id = v_content_row_id;
        v_total_digabung := v_total_digabung + 1;
      else
        update rekening_belanja set kode_rekening = v_target_kode where id = v_content_row_id;
        v_total_dibetulkan := v_total_dibetulkan + 1;
      end if;
    else
      -- baris belum ada sama sekali -> buat baru + DPA tahapan murni/pergeseran
      insert into rekening_belanja (sub_kegiatan_id, kode_rekening, jenis_belanja, sumber_dana)
        values (v_sub_id, v_target_kode, rec.jenis_belanja, rec.sumber_dana)
        on conflict (sub_kegiatan_id, kode_rekening, sumber_dana) do nothing
        returning id into v_new_rekening_id;
      if v_new_rekening_id is null then
        select id into v_new_rekening_id from rekening_belanja
          where sub_kegiatan_id = v_sub_id and kode_rekening = v_target_kode and sumber_dana = rec.sumber_dana;
      end if;
      insert into dpa (rekening_id, tahun_anggaran, tahapan, pagu_anggaran, pptk_id)
        values (v_new_rekening_id, 2026, 'murni', rec.murni, v_pptk_id)
        on conflict (rekening_id, tahun_anggaran, tahapan) do nothing;
      insert into dpa (rekening_id, tahun_anggaran, tahapan, pagu_anggaran, pptk_id)
        values (v_new_rekening_id, 2026, 'pergeseran', rec.pergeseran, v_pptk_id)
        on conflict (rekening_id, tahun_anggaran, tahapan) do nothing;
      v_total_dibuat_baru := v_total_dibuat_baru + 1;
    end if;
  end loop;

  raise notice 'Rekonsiliasi selesai: % kode rekening dibetulkan langsung, % digabung (merge duplikat), % baris baru dibuat.',
    v_total_dibetulkan, v_total_digabung, v_total_dibuat_baru;
end $$;

-- =========================================================
-- Baris yang TIDAK ADA di lampiran "1__DATABASE.pdf" (kemungkinan
-- salah input kode rekening saat impor) -- "Belanja Perjalanan Dinas
-- Paket Meeting Dalam Kota" pada Sub Kegiatan Koordinasi, Sinkronisasi
-- dan Evaluasi Kebijakan Pertanian, Kehutanan, Kelautan dan Perikanan.
-- Dihapus HANYA jika belum pernah dipakai di Pengajuan Belanja manapun.
-- =========================================================
do $$
declare
  v_rekening_id uuid;
  v_dpa_id uuid;
  v_terpakai int;
begin
  select rb.id into v_rekening_id
    from rekening_belanja rb
    join sub_kegiatan sk on sk.id = rb.sub_kegiatan_id
    where sk.kode_sub_kegiatan = '4.01.03.2.04.0001' and sk.tahun_anggaran = 2026
      and rb.kode_rekening like '%5.1.02.04.001.00003'
    limit 1;

  if v_rekening_id is null then
    raise notice 'Baris "Paket Meeting Dalam Kota" (00003) tidak ditemukan -- sudah bersih.';
    return;
  end if;

  select count(*) into v_terpakai from pengajuan_belanja p
    join dpa d on d.id = p.dpa_id where d.rekening_id = v_rekening_id;

  if v_terpakai > 0 then
    raise notice 'BATAL hapus baris "Paket Meeting Dalam Kota" -- sudah dipakai % Pengajuan Belanja. Pindahkan manual dulu ke "Belanja Perjalanan Dinas Dalam Kota" (...00004) sebelum menghapus baris ini.', v_terpakai;
    return;
  end if;

  delete from dpa where rekening_id = v_rekening_id;
  delete from rekening_belanja where id = v_rekening_id;
  raise notice 'Baris "Paket Meeting Dalam Kota" (00003, tidak ada di lampiran) berhasil dihapus.';
end $$;
