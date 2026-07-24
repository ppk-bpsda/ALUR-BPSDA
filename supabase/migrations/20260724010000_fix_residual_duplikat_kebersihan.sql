-- =========================================================
-- DIAGNOSTIK: cek apakah migration cleanup sebelumnya sudah pernah
-- jalan, dan kenapa baris duplikat '5.1.02.02.001.00030' (Belanja Jasa
-- Tenaga Kebersihan) masih ada.
-- =========================================================
-- JALANKAN QUERY INI DULU (select, aman, tidak mengubah apa-apa),
-- lihat hasilnya sebelum lanjut ke bagian FIX di bawah.

select
  d.id as dpa_id,
  d.tahapan,
  d.pagu_anggaran,
  rb.id as rekening_id,
  rb.kode_rekening,
  sk.kode_sub_kegiatan,
  (select count(*) from pengajuan_belanja p where p.dpa_id = d.id) as jumlah_pengajuan_terpakai
from dpa d
join rekening_belanja rb on rb.id = d.rekening_id
join sub_kegiatan sk on sk.id = rb.sub_kegiatan_id
where rb.kode_rekening in ('5.1.02.02.001.00030', '4.01.01.2.08.0004.5.1.02.02.001.00030')
order by rb.kode_rekening, d.tahapan;

-- Baca hasilnya:
--   * Kalau baris dengan kode_rekening = '5.1.02.02.001.00030' MUNCUL dan
--     jumlah_pengajuan_terpakai = 0  -> migration cleanup sebelumnya memang
--     belum pernah dijalankan di database ini. Lanjut ke bagian FIX.
--   * Kalau baris itu MUNCUL dan jumlah_pengajuan_terpakai > 0 -> ada
--     Pengajuan Belanja yang terlanjur memakai rekening lama ini (biasanya
--     dari waktu testing). Sebelum dihapus, pengajuan itu perlu dipindah
--     dulu ke rekening yang benar (4.01.01.2.08.0004.5.1.02.02.001.00030)
--     lewat menu Pengajuan, atau beri tahu saya nomor pengajuannya supaya
--     saya bantu buatkan query pemindahannya.
--   * Kalau baris '5.1.02.02.001.00030' TIDAK MUNCUL sama sekali -> sudah
--     bersih, berarti selisih 32.100.000 di Dashboard berasal dari sumber
--     lain (bukan baris ini) -- kabari saya, akan saya telusuri ulang.

-- =========================================================
-- FIX: hapus khusus baris duplikat ini (hanya jalan kalau BENAR-BENAR
-- belum ada pengajuan_belanja yang memakainya -- aman, idempotent).
-- =========================================================
do $$
declare
  v_dpa_id uuid;
  v_rekening_id uuid;
  v_terpakai int;
begin
  select d.id, rb.id
  into v_dpa_id, v_rekening_id
  from dpa d
  join rekening_belanja rb on rb.id = d.rekening_id
  where rb.kode_rekening = '5.1.02.02.001.00030'
    and d.tahapan = 'murni'
  limit 1;

  if v_dpa_id is null then
    raise notice 'Baris duplikat 5.1.02.02.001.00030 tidak ditemukan -- sudah bersih atau belum pernah ada.';
    return;
  end if;

  select count(*) into v_terpakai from pengajuan_belanja where dpa_id = v_dpa_id;
  if v_terpakai > 0 then
    raise notice 'BATAL hapus -- ada % Pengajuan Belanja yang memakai dpa_id %. Pindahkan dulu pengajuannya ke rekening yang benar sebelum menghapus baris ini.', v_terpakai, v_dpa_id;
    return;
  end if;

  delete from dpa where id = v_dpa_id;
  delete from rekening_belanja where id = v_rekening_id
    and not exists (select 1 from dpa where rekening_id = v_rekening_id);

  raise notice 'Berhasil dihapus: dpa_id % dan rekening_belanja (5.1.02.02.001.00030) yang sudah tidak dipakai lagi.', v_dpa_id;
end $$;

-- =========================================================
-- JALANKAN ULANG cleanup umum sebelumnya juga (aman diulang / idempotent)
-- untuk memastikan tidak ada baris duplikat format-pendek lain yang
-- tertinggal dengan pola yang sama.
-- =========================================================
do $$
declare
  v_dpa_terpakai int;
  v_dpa_dihapus int;
  v_rekening_dihapus int;
begin
  select count(*) into v_dpa_terpakai
  from dpa d
  join rekening_belanja rb on rb.id = d.rekening_id
  join sub_kegiatan sk on sk.id = rb.sub_kegiatan_id
  where d.tahapan = 'murni'
    and rb.kode_rekening not like (sk.kode_sub_kegiatan || '.%')
    and exists (select 1 from pengajuan_belanja p where p.dpa_id = d.id);

  if v_dpa_terpakai > 0 then
    raise notice 'Masih ada % baris dpa (tahapan murni, format kode lama) yang SUDAH punya Pengajuan Belanja -- cek manual.', v_dpa_terpakai;
  end if;

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

  with yatim as (
    select rb.id
    from rekening_belanja rb
    join sub_kegiatan sk on sk.id = rb.sub_kegiatan_id
    where rb.kode_rekening not like (sk.kode_sub_kegiatan || '.%')
      and not exists (select 1 from dpa d where d.rekening_id = rb.id)
  )
  delete from rekening_belanja where id in (select id from yatim);
  get diagnostics v_rekening_dihapus = row_count;

  raise notice 'Cleanup ulang: % baris dpa dan % baris rekening_belanja format lama terhapus.', v_dpa_dihapus, v_rekening_dihapus;
end $$;
