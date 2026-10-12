-- =========================================================
-- PERBAIKAN BUG: migrasi impor awal membuat baris `pejabat_skpd` BARU
-- untuk setiap kombinasi (nama PPTK, sub kegiatan) -- jadi "Sari Anas
-- Putri" misalnya tercatat sebagai banyak baris terpisah (satu per sub
-- kegiatan yang dia tangani), bukan satu orang satu baris. NIP-nya juga
-- cuma diisi placeholder 'TBD'.
--
-- Sekarang PPTK sudah tidak lagi diikat ke satu sub kegiatan (penugasan
-- PPTK ke rekening dilakukan di menu Rekening & Pagu lewat dpa.pptk_id),
-- jadi duplikasi ini perlu dibereskan: gabungkan jadi satu baris per
-- (nama, tahun_anggaran), pindahkan semua referensi dpa.pptk_id ke baris
-- kanonik itu, baru hapus baris duplikatnya.
-- =========================================================

-- Kolom baru: Judul SK (mis. "Penunjukan PPTK Belanja Sekretariat Daerah
-- Tahun Anggaran 2026"), terpisah dari Nomor SK & Tanggal SK yang sudah ada.
alter table pejabat_skpd add column if not exists judul_sk text;

-- Pilih 1 baris kanonik per (jabatan, nama, tahun_anggaran) -- yang
-- dibuat paling awal (created_at/ id terkecil kalau tidak ada created_at).
with kanonik as (
  select distinct on (jabatan, nama, tahun_anggaran)
    id as canonical_id, jabatan, nama, tahun_anggaran
  from pejabat_skpd
  order by jabatan, nama, tahun_anggaran, id
),
pemetaan as (
  select p.id as old_id, k.canonical_id
  from pejabat_skpd p
  join kanonik k
    on k.jabatan = p.jabatan and k.nama = p.nama and k.tahun_anggaran = p.tahun_anggaran
  where p.id <> k.canonical_id
)
update dpa
set pptk_id = pemetaan.canonical_id
from pemetaan
where dpa.pptk_id = pemetaan.old_id;

-- Baris duplikat (bukan kanonik) sekarang aman dihapus -- tidak ada lagi
-- dpa yang mereferensikannya.
with kanonik as (
  select distinct on (jabatan, nama, tahun_anggaran) id as canonical_id
  from pejabat_skpd
  order by jabatan, nama, tahun_anggaran, id
)
delete from pejabat_skpd
where id not in (select canonical_id from kanonik);

-- NIP placeholder 'TBD' dari migrasi impor dikosongkan lagi supaya form
-- Manajemen Akun jelas menunjukkan ini BELUM diisi NIP asli, bukan
-- kelihatan seperti sudah terisi.
update pejabat_skpd set nip = '' where nip = 'TBD';
