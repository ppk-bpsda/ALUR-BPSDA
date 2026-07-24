-- =========================================================
-- PINDAHKAN DATA DUPLIKAT '5.1.02.02.001.00030' (MURNI) KE TAHAPAN
-- PERGESERAN PADA REKENING KODE LENGKAP YANG BENAR
-- =========================================================
-- Konfirmasi dari pengguna aplikasi: baris duplikat rekening_belanja
-- dengan kode pendek '5.1.02.02.001.00030' (tahapan 'murni', pagu
-- 32.100.000) itu SEHARUSNYA TIDAK ADA di tahapan 'murni' sama sekali --
-- kode rekening yang dipakai semestinya '4.01.01.2.08.0004.5.1.02.02.001.00030'
-- (kode lengkap), dan nominal 32.100.000 itu miliknya tahapan
-- 'pergeseran', bukan 'murni'. Migrasi cleanup sebelumnya
-- (20260724010000) menahan diri menghapus baris ini kalau sudah dipakai
-- transaksi -- migrasi ini melanjutkan dengan MEMINDAHKAN dulu semua
-- transaksi & pagu-nya ke tempat yang benar, baru menghapus baris lama.
--
-- Aman & idempotent: kalau baris duplikat sudah tidak ada (sudah pernah
-- jalan / sudah dibersihkan manual), migrasi ini langsung berhenti tanpa
-- mengubah apa-apa.
-- =========================================================

do $$
declare
  v_dpa_lama_id uuid;
  v_rekening_lama_id uuid;
  v_pagu_lama numeric;
  v_tahun_lama int;
  v_nomor_dpa_lama text;
  v_tanggal_penetapan_lama date;
  v_pptk_lama uuid;
  v_rekening_benar_id uuid;
  v_dpa_pergeseran_benar_id uuid;
  v_pagu_pergeseran_sekarang numeric;
  v_pindah_count int;
begin
  -- 1) Cari baris duplikat lama: kode pendek, tahapan MURNI.
  select d.id, rb.id, d.pagu_anggaran, d.tahun_anggaran, d.nomor_dpa, d.tanggal_penetapan, d.pptk_id
    into v_dpa_lama_id, v_rekening_lama_id, v_pagu_lama, v_tahun_lama, v_nomor_dpa_lama, v_tanggal_penetapan_lama, v_pptk_lama
  from dpa d
  join rekening_belanja rb on rb.id = d.rekening_id
  where rb.kode_rekening = '5.1.02.02.001.00030'
    and d.tahapan = 'murni'
  limit 1;

  if v_dpa_lama_id is null then
    raise notice 'Baris duplikat murni (kode pendek 5.1.02.02.001.00030) tidak ditemukan -- sudah bersih, tidak ada yang diubah.';
    return;
  end if;

  raise notice 'Ditemukan baris duplikat: dpa_id=%, pagu=%, tahun=%.', v_dpa_lama_id, v_pagu_lama, v_tahun_lama;

  -- 2) Cari rekening_belanja yang BENAR (kode lengkap dengan prefix sub kegiatan).
  select id into v_rekening_benar_id
  from rekening_belanja
  where kode_rekening = '4.01.01.2.08.0004.5.1.02.02.001.00030'
  limit 1;

  if v_rekening_benar_id is null then
    raise notice 'Rekening kode lengkap 4.01.01.2.08.0004.5.1.02.02.001.00030 TIDAK ditemukan -- berhenti, cek manual dulu di menu Rekening & Pagu.';
    return;
  end if;

  -- 3) Cari (atau buat) baris dpa tahapan PERGESERAN pada rekening yang benar.
  select id, pagu_anggaran into v_dpa_pergeseran_benar_id, v_pagu_pergeseran_sekarang
  from dpa
  where rekening_id = v_rekening_benar_id
    and tahapan = 'pergeseran'
    and tahun_anggaran = v_tahun_lama
  limit 1;

  if v_dpa_pergeseran_benar_id is null then
    insert into dpa (rekening_id, tahapan, tahun_anggaran, pagu_anggaran, nomor_dpa, tanggal_penetapan, pptk_id)
    values (v_rekening_benar_id, 'pergeseran', v_tahun_lama, v_pagu_lama, v_nomor_dpa_lama, v_tanggal_penetapan_lama, v_pptk_lama)
    returning id into v_dpa_pergeseran_benar_id;
    raise notice 'Dibuat baris dpa PERGESERAN baru pada rekening lengkap (dpa_id=%), pagu = %.', v_dpa_pergeseran_benar_id, v_pagu_lama;
  else
    raise notice 'Baris dpa PERGESERAN pada rekening lengkap SUDAH ADA (dpa_id=%, pagu sekarang=%). Pagu TIDAK ditimpa otomatis -- cek manual di menu Rekening & Pagu apakah pagu-nya perlu disesuaikan (mis. ditambah %).', v_dpa_pergeseran_benar_id, v_pagu_pergeseran_sekarang, v_pagu_lama;
  end if;

  -- 4) Pindahkan semua Pengajuan Belanja dari dpa lama (murni, kode pendek)
  --    ke dpa pergeseran yang benar.
  update pengajuan_belanja
     set dpa_id = v_dpa_pergeseran_benar_id
   where dpa_id = v_dpa_lama_id;
  get diagnostics v_pindah_count = row_count;

  if v_pindah_count > 0 then
    raise notice 'Dipindahkan % baris Pengajuan Belanja dari dpa lama (murni) ke dpa yang benar (pergeseran).', v_pindah_count;
  end if;

  -- 5) Hapus dpa & rekening_belanja lama yang sekarang sudah tidak dipakai.
  delete from dpa where id = v_dpa_lama_id;
  delete from rekening_belanja where id = v_rekening_lama_id
    and not exists (select 1 from dpa where rekening_id = v_rekening_lama_id);

  raise notice 'SELESAI -- baris duplikat murni (kode pendek 5.1.02.02.001.00030) sudah dihapus. Data & transaksinya sudah dipindah ke tahapan pergeseran pada rekening kode lengkap.';
end $$;
