-- =========================================================
-- BERSIHKAN DUPLIKASI REKENING & PAGU DI TAHAPAN MURNI
-- =========================================================
-- AKAR MASALAH:
-- Migrasi lama (20260714100002_seed_master_data_v2.sql) sempat mengisi
-- rekening_belanja + dpa (tahapan 'murni') pakai KODE REKENING BELANJA
-- SAJA (mis. '5.1.01.03.007.00001', TANPA prefix kode sub kegiatan).
-- Migrasi belakangan (20260716130000 import rekening dpa 2026.sql) mengisi
-- ulang data yang SAMA (akun yang sama, sub kegiatan yang sama) tapi pakai
-- KODE REKENING LENGKAP (mis. '4.01.01.2.02.0002.5.1.02.02.001.00080',
-- SUDAH termasuk prefix sub kegiatan) untuk tahapan 'murni' DAN 'pergeseran'.
--
-- Karena constraint unik rekening_belanja adalah
-- (sub_kegiatan_id, kode_rekening, sumber_dana), dan kode_rekening kedua
-- baris itu BERBEDA (pendek vs lengkap), keduanya tersimpan sebagai DUA
-- baris rekening_belanja + DUA baris dpa 'murni' yang terpisah untuk akun
-- yang sebenarnya SAMA -- makanya total pagu MURNI di Rekap Realisasi jadi
-- dua kali lipat. Tahapan 'pergeseran' tidak kena masalah ini karena hanya
-- pernah diisi sekali (format lengkap saja) oleh migrasi yang lebih baru.
--
-- PERBAIKAN: hapus baris rekening_belanja (dan dpa yang menempel) yang
-- kode_rekening-nya TIDAK diawali kode_sub_kegiatan-nya sendiri -- itu
-- ciri baris lama/pendek yang sudah digantikan oleh baris kode lengkap.
-- Aman & idempotent:
--   * Kalau baris "lama" itu ternyata SUDAH punya pengajuan_belanja
--     tercatat (dipakai transaksi sungguhan, bukan cuma sisa seed), migrasi
--     ini TIDAK menghapusnya -- dibiarkan apa adanya supaya data transaksi
--     tidak pernah hilang diam-diam, dan akan muncul di NOTICE supaya bisa
--     dicek manual.
--   * Kalau dijalankan ulang, tidak akan menemukan baris yang sama lagi
--     (sudah terhapus di jalan pertama) -- tidak error, tidak mengubah apa-apa.
-- =========================================================

do $$
declare
  v_dpa_terpakai int;
  v_dpa_dihapus int;
  v_rekening_dihapus int;
begin
  -- Baris dpa "lama" (kode_rekening format pendek) yang MASIH punya
  -- pengajuan_belanja tercatat -- jangan dihapus, cuma dilaporkan.
  select count(*) into v_dpa_terpakai
  from dpa d
  join rekening_belanja rb on rb.id = d.rekening_id
  join sub_kegiatan sk on sk.id = rb.sub_kegiatan_id
  where d.tahapan = 'murni'
    and rb.kode_rekening not like (sk.kode_sub_kegiatan || '.%')
    and exists (select 1 from pengajuan_belanja p where p.dpa_id = d.id);

  if v_dpa_terpakai > 0 then
    raise notice 'Ada % baris dpa (tahapan murni, kode rekening format lama/pendek) yang SUDAH punya Pengajuan Belanja -- TIDAK dihapus otomatis, cek manual lewat menu Rekening & Pagu.', v_dpa_terpakai;
  end if;

  -- Hapus baris dpa "lama" yang AMAN dihapus (belum ada pengajuan_belanja).
  with lama as (
    select d.id
    from dpa d
    join rekening_belanja rb on rb.id = d.rekening_id
    join sub_kegiatan sk on sk.id = rb.sub_kegiatan_id
    where d.tahapan = 'murni'
      and rb.kode_rekening not like (sk.kode_sub_kegiatan || '.%')
      and not exists (select 1 from pengajuan_belanja p where p.dpa_id = d.id)
  )
  delete from dpa where id in (select id from lama);
  get diagnostics v_dpa_dihapus = row_count;

  -- Baris rekening_belanja "lama" yang sudah tidak dipakai dpa manapun lagi
  -- (setelah dpa-nya dihapus di atas) -- bersihkan juga supaya tidak jadi
  -- data yatim yang membingungkan di form Pengajuan/Rekening.
  with yatim as (
    select rb.id
    from rekening_belanja rb
    join sub_kegiatan sk on sk.id = rb.sub_kegiatan_id
    where rb.kode_rekening not like (sk.kode_sub_kegiatan || '.%')
      and not exists (select 1 from dpa d where d.rekening_id = rb.id)
  )
  delete from rekening_belanja where id in (select id from yatim);
  get diagnostics v_rekening_dihapus = row_count;

  raise notice 'Dihapus % baris dpa lama dan % baris rekening_belanja lama (format kode pendek, sudah digantikan kode lengkap).', v_dpa_dihapus, v_rekening_dihapus;
end $$;
