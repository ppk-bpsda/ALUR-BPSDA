-- =========================================================
-- PERUBAHAN KEBIJAKAN: Realisasi hanya dihitung dari Pengajuan Belanja
-- berstatus 'dicairkan' -- status 'disetujui' BELUM dianggap
-- "terealisasi" secara kas (baru dianggap terealisasi begitu benar-benar
-- cair/dibayarkan).
--
-- Sebelumnya (migrasi 20260726000000_akumulasi_realisasi_lintas_tahapan):
-- view rekap_realisasi menghitung total_realisasi dari status
-- 'disetujui' MAUPUN 'dicairkan'. Migrasi ini mempersempit jadi
-- 'dicairkan' saja -- struktur & logika akumulasi lintas tahapan
-- lainnya (lihat migrasi 20260726000000) TIDAK berubah.
--
-- Ini memengaruhi kartu "Total Realisasi"/"Total Sisa" di Dashboard dan
-- kolom Realisasi/Sisa di halaman /rekap (keduanya baca dari view ini).
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
left join (
  -- Akumulasi realisasi per rekening & tahun anggaran, LINTAS SEMUA
  -- TAHAPAN (murni, pergeseran, perubahan digabung jadi satu total),
  -- HANYA status 'dicairkan'.
  select
    d2.rekening_id,
    d2.tahun_anggaran,
    sum(p.jumlah_pengajuan) as total_realisasi
  from dpa d2
  join pengajuan_belanja p on p.dpa_id = d2.id
  where p.status = 'dicairkan'
  group by d2.rekening_id, d2.tahun_anggaran
) realisasi
  on realisasi.rekening_id = d.rekening_id
 and realisasi.tahun_anggaran = d.tahun_anggaran;

-- Pertahankan security_invoker=on (lihat migrasi 20260714100003 &
-- 20260716120000) supaya RLS tabel dasar tetap berlaku normal saat
-- view ini diakses lewat user yang login, bukan lewat hak akses
-- pemilik view.
alter view public.rekap_realisasi set (security_invoker = on);
