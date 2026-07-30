-- =========================================================
-- KOREKSI ATURAN AKUMULASI REALISASI LINTAS TAHAPAN
-- =========================================================
-- Sebelumnya (migrasi 20260726000000 & 20260730010000): kolom
-- total_realisasi di view rekap_realisasi SELALU menjumlahkan realisasi
-- dari SEMUA tahapan (murni + pergeseran + perubahan) tanpa syarat --
-- berapa pun tahapan yang sedang dibuka/ditampilkan.
--
-- Aturan bisnis yang benar (dikonfirmasi pengguna):
--   - PAGU mengikuti tahapan yang sedang dipilih SAJA (tidak berubah
--     oleh migrasi ini -- kolom pagu_anggaran tetap dari baris dpa itu
--     sendiri).
--   - REALISASI mengakumulasi tahapan-tahapan yang URUTANNYA <=
--     tahapan yang sedang dilihat:
--       * dibuka di tahapan Murni      -> realisasi = Murni saja
--       * dibuka di tahapan Pergeseran -> realisasi = Murni + Pergeseran
--       * dibuka di tahapan Perubahan  -> realisasi = Murni + Pergeseran
--                                          + Perubahan
--   - Sisa = Pagu (tahapan yang dipilih) - Realisasi akumulasi tsb.
--
-- Ini penting terutama untuk kasus user membuka KEMBALI tahapan Murni
-- setelah tahapan Pergeseran/Perubahan sudah punya realisasi sendiri --
-- realisasi Pergeseran/Perubahan TIDAK BOLEH ikut tampil di tahapan
-- Murni. Sebaliknya, saat di tahapan Perubahan, realisasi Murni &
-- Pergeseran yang terjadi sebelumnya tetap harus ikut terakumulasi.
--
-- Urutan tahapan mengikuti resolveDpaId() di komponen PengajuanForm.tsx
-- (Murni=1, Pergeseran=2, Perubahan=3) -- lihat juga lib/periode.ts
-- (tahapanUpTo) untuk pemetaan yang sama di sisi aplikasi/TypeScript.
-- =========================================================

create or replace view public.rekap_realisasi as
select
  d.id as dpa_id,
  sk.kode_sub_kegiatan,
  sk.nama_sub_kegiatan,
  r.kode_rekening,
  r.jenis_belanja,
  r.sumber_dana,
  d.tahun_anggaran,
  d.tahapan,
  d.pagu_anggaran,
  coalesce(realisasi.total_realisasi, 0) as total_realisasi,
  d.pagu_anggaran - coalesce(realisasi.total_realisasi, 0) as sisa_anggaran
from dpa d
join rekening_belanja r on r.id = d.rekening_id
join sub_kegiatan sk on sk.id = r.sub_kegiatan_id
left join lateral (
  -- Akumulasi realisasi per rekening & tahun anggaran, HANYA dari
  -- tahapan yang urutannya <= tahapan baris dpa (d) ini sendiri, status
  -- 'dicairkan' saja.
  select sum(p.jumlah_pengajuan) as total_realisasi
  from dpa d2
  join pengajuan_belanja p on p.dpa_id = d2.id
  where d2.rekening_id = d.rekening_id
    and d2.tahun_anggaran = d.tahun_anggaran
    and p.status = 'dicairkan'
    and (case d2.tahapan
           when 'murni' then 1
           when 'pergeseran' then 2
           when 'perubahan' then 3
         end)
        <=
        (case d.tahapan
           when 'murni' then 1
           when 'pergeseran' then 2
           when 'perubahan' then 3
         end)
) realisasi on true;

-- Pertahankan security_invoker=on (lihat migrasi 20260714100003 &
-- 20260716120000) supaya RLS tabel dasar tetap berlaku normal saat
-- view ini diakses lewat user yang login, bukan lewat hak akses
-- pemilik view.
alter view public.rekap_realisasi set (security_invoker = on);
