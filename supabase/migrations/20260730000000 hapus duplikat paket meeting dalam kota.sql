-- =========================================================
-- LANJUTAN migrasi 20260729000000_rekonsiliasi_kode_rekening_lampiran_database.sql
--
-- LATAR BELAKANG:
-- Migrasi 20260729 tidak menghapus baris "Belanja Perjalanan Dinas Paket
-- Meeting Dalam Kota" (kode ...5.1.02.04.001.00003, Sub Kegiatan
-- 4.01.03.2.04.0001, PAD) karena baris itu sudah dipakai di Pengajuan
-- Belanja (lihat NOTICE saat migrasi itu dijalankan). Baris ini TIDAK ADA
-- di lampiran "1__DATABASE.pdf" -- pagunya (Rp 5.000.000 Murni & Rp
-- 5.000.000 Pergeseran) adalah duplikat dari baris pengganti yang benar
-- "Belanja Perjalanan Dinas Dalam Kota" (...00004) yang sudah dibuat
-- migrasi 20260729 dengan pagu yang sama. Akibatnya total Pagu di
-- halaman /rekap kelebihan Rp 5.000.000 (dihitung dobel dari 2 baris).
--
-- PERBAIKAN:
-- 1) Pindahkan seluruh Pengajuan Belanja yang masih menempel di DPA
--    baris lama (00003) ke baris DPA yang benar (00004) pada tahapan
--    yang sama -- pagu baris 00004 TIDAK ditambah/digabung (pagunya
--    sudah benar sesuai lampiran), hanya referensi Pengajuan-nya yang
--    dipindah.
-- 2) Hapus DPA & baris rekening_belanja lama (00003) setelah kosong.
-- Aman dijalankan ulang (idempotent) -- kalau baris lama sudah tidak
-- ada, migrasi ini tidak melakukan apa-apa.
-- =========================================================

do $$
declare
  v_old_rekening_id uuid;
  v_new_rekening_id uuid;
  v_dpa_old record;
  v_dpa_new_id uuid;
  v_dipindah int := 0;
begin
  select rb.id into v_old_rekening_id
    from rekening_belanja rb
    join sub_kegiatan sk on sk.id = rb.sub_kegiatan_id
    where sk.kode_sub_kegiatan = '4.01.03.2.04.0001' and sk.tahun_anggaran = 2026
      and rb.sumber_dana = 'PAD'
      and rb.kode_rekening like '%5.1.02.04.001.00003'
    limit 1;

  if v_old_rekening_id is null then
    raise notice 'Baris duplikat "Paket Meeting Dalam Kota" (00003) tidak ditemukan -- sudah bersih, tidak ada yang perlu dilakukan.';
    return;
  end if;

  select rb.id into v_new_rekening_id
    from rekening_belanja rb
    join sub_kegiatan sk on sk.id = rb.sub_kegiatan_id
    where sk.kode_sub_kegiatan = '4.01.03.2.04.0001' and sk.tahun_anggaran = 2026
      and rb.sumber_dana = 'PAD'
      and rb.kode_rekening like '%5.1.02.04.001.00004'
    limit 1;

  if v_new_rekening_id is null then
    raise notice 'BATAL: baris pengganti "Belanja Perjalanan Dinas Dalam Kota" (00004) belum ada -- jalankan dulu migrasi 20260729000000_rekonsiliasi_kode_rekening_lampiran_database.sql (versi terbaru).';
    return;
  end if;

  -- Pindahkan Pengajuan Belanja dari tiap baris DPA lama (per tahapan)
  -- ke baris DPA baru dengan tahapan yang sama. Kalau baris DPA baru
  -- untuk tahapan itu belum ada, buat dulu dengan pagu 0 (bukan
  -- menjumlahkan pagu lama -- pagu yang benar sudah ditetapkan
  -- migrasi 20260729 sesuai lampiran).
  for v_dpa_old in select * from dpa where rekening_id = v_old_rekening_id loop
    select id into v_dpa_new_id from dpa
      where rekening_id = v_new_rekening_id and tahapan = v_dpa_old.tahapan;

    if v_dpa_new_id is null then
      insert into dpa (rekening_id, tahun_anggaran, tahapan, pagu_anggaran, pptk_id)
        values (v_new_rekening_id, v_dpa_old.tahun_anggaran, v_dpa_old.tahapan, 0, v_dpa_old.pptk_id)
        returning id into v_dpa_new_id;
    end if;

    update pengajuan_belanja set dpa_id = v_dpa_new_id where dpa_id = v_dpa_old.id;
    get diagnostics v_dipindah = row_count;

    delete from dpa where id = v_dpa_old.id;
  end loop;

  delete from rekening_belanja where id = v_old_rekening_id;

  raise notice 'Baris duplikat "Paket Meeting Dalam Kota" (00003) berhasil dihapus setelah Pengajuan Belanja-nya dipindah ke "Belanja Perjalanan Dinas Dalam Kota" (00004).';
end $$;
