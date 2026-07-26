-- =========================================================
-- FIX: Rekap Realisasi -- akumulasi realisasi lintas tahapan
-- =========================================================
-- Permintaan pengguna:
-- Menu /rekap tetap berlaku untuk semua tahapan (murni/pergeseran/
-- perubahan). Yang menyesuaikan HANYA pagu-nya (sesuai tahapan yang
-- dipilih), sedangkan REALISASI harus berupa AKUMULASI dari seluruh
-- tahapan (murni + pergeseran + perubahan) pada rekening & tahun
-- anggaran yang sama -- bukan realisasi yang terpisah per tahapan.
--
-- Contoh: kalau di tahapan murni sudah ada realisasi 6.350.000, maka
-- saat user membuka tahapan pergeseran atau perubahan (rekening yang
-- sama), kolom Realisasi tetap menampilkan angka akumulasi tsb
-- (ditambah realisasi baru yang terjadi di pergeseran/perubahan kalau
-- ada), dan Sisa = Pagu (sesuai tahapan yang dipilih) - Realisasi
-- akumulasi itu. Jadi Sisa TIDAK dihitung terpisah per tahapan.
--
-- Sebelumnya (init_schema_v2): total_realisasi dihitung hanya dari
-- pengajuan_belanja yang dpa_id-nya persis sama dengan baris dpa
-- tahapan yang sedang dilihat -- sehingga realisasi tahapan murni
-- "hilang" ketika pindah ke tahapan pergeseran/perubahan. Migrasi ini
-- memperbaikinya dengan menjumlahkan realisasi dari SEMUA baris dpa
-- (semua tahapan) yang rekening_id & tahun_anggaran-nya sama.
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
  -- TAHAPAN (murni, pergeseran, perubahan digabung jadi satu total).
  select
    d2.rekening_id,
    d2.tahun_anggaran,
    sum(p.jumlah_pengajuan) as total_realisasi
  from dpa d2
  join pengajuan_belanja p on p.dpa_id = d2.id
  where p.status in ('disetujui', 'dicairkan')
  group by d2.rekening_id, d2.tahun_anggaran
) realisasi
  on realisasi.rekening_id = d.rekening_id
 and realisasi.tahun_anggaran = d.tahun_anggaran;

-- Pertahankan security_invoker=on (lihat migrasi 20260714100003 &
-- 20260716120000) supaya RLS tabel dasar tetap berlaku normal saat
-- view ini diakses lewat user yang login, bukan lewat hak akses
-- pemilik view.
alter view public.rekap_realisasi set (security_invoker = on);
