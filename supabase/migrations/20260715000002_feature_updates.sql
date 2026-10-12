-- =========================================================
-- FEATURE UPDATES:
--   1) Login pakai USERNAME (bukan email) -- tabel profiles +
--      fungsi lookup email dari username untuk proses sign in.
--   2) Admin bisa menambah akun lain (lewat halaman /akun,
--      pakai service_role di server action).
--   3) Pejabat SKPD digabung: KPA, BENDAHARA_PENGELUARAN_PEMBANTU,
--      dan PPTK jadi satu tabel dgn CRUD penuh (tambah/edit/hapus).
--      Tabel `pptk` lama dimigrasi lalu dihapus.
--   4) Menu Penerima dihapus -- nama penerima kwitansi sekarang
--      teks bebas di pengajuan_belanja (prefill dari Nama Direktur
--      Penyedia di sisi aplikasi), tabel `penerima` dihapus.
-- =========================================================

-- ---------------------------------------------------------
-- 1) PROFILES (username login)
-- ---------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  nama text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Semua akun setara (akses penuh), termasuk untuk melihat/mengelola
-- daftar akun di halaman Manajemen Akun.
create policy "admin full access" on profiles for all to authenticated using (true) with check (true);

-- Dipanggil dari halaman login (belum ada sesi / anon) untuk menerjemahkan
-- username -> email asli yang dipakai Supabase Auth di baliknya.
-- SECURITY DEFINER supaya bisa baca tabel profiles + auth.users walau
-- pemanggilnya masih anon, tapi hanya mengembalikan satu kolom email.
create or replace function public.get_login_email(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select au.email
  from public.profiles p
  join auth.users au on au.id = p.id
  where lower(p.username) = lower(p_username)
  limit 1;
$$;

revoke all on function public.get_login_email(text) from public;
grant execute on function public.get_login_email(text) to anon, authenticated;

-- ---------------------------------------------------------
-- 2) PEJABAT SKPD -- gabungkan KPA, BPP, PPTK + full CRUD
-- ---------------------------------------------------------
alter type jabatan_skpd add value if not exists 'PPTK';

alter table pejabat_skpd
  add column if not exists sub_kegiatan_id uuid references sub_kegiatan(id) on delete cascade,
  add column if not exists nomor_sk text,
  add column if not exists tanggal_sk date,
  add column if not exists aktif boolean not null default true;

-- Longgarkan batasan lama (1 baris per jabatan per tahun) supaya
-- Admin bisa tambah/edit/hapus bebas (mis. beberapa PPTK per tahun,
-- riwayat pergantian pejabat, dsb).
alter table pejabat_skpd drop constraint if exists pejabat_skpd_jabatan_tahun_anggaran_key;

-- ---------------------------------------------------------
-- 3) Migrasi data dari tabel `pptk` lama -> pejabat_skpd, lalu drop
-- ---------------------------------------------------------
insert into pejabat_skpd (jabatan, nama, nip, tahun_anggaran, sub_kegiatan_id, nomor_sk, tanggal_sk)
select 'PPTK', nama, nip, tahun_anggaran, sub_kegiatan_id, nomor_sk, tanggal_sk
from pptk;

alter table dpa add column if not exists pptk_pejabat_id uuid references pejabat_skpd(id);

update dpa d
set pptk_pejabat_id = ps.id
from pptk p
join rekening_belanja r on r.id = d.rekening_id
join pejabat_skpd ps
  on ps.jabatan = 'PPTK'
 and ps.sub_kegiatan_id = p.sub_kegiatan_id
 and ps.tahun_anggaran = p.tahun_anggaran
where d.pptk_id = p.id
  and r.sub_kegiatan_id = p.sub_kegiatan_id;

alter table dpa drop column if exists pptk_id;
alter table dpa rename column pptk_pejabat_id to pptk_id;
alter table dpa rename constraint dpa_pptk_pejabat_id_fkey to dpa_pptk_id_fkey;

drop table if exists pptk;

-- ---------------------------------------------------------
-- 4) Hapus menu/tabel Penerima -- ganti jadi teks bebas di pengajuan
-- ---------------------------------------------------------
alter table pengajuan_belanja add column if not exists nama_penerima text;

update pengajuan_belanja pb
set nama_penerima = pen.nama_penerima
from penerima pen
where pb.penerima_id = pen.id;

alter table pengajuan_belanja drop column if exists penerima_id;
drop table if exists penerima;

-- ---------------------------------------------------------
-- NOTE: Buat akun pertama lewat SQL Editor (contoh di bawah), lalu
-- akun berikutnya bisa dibuat Admin lewat halaman /akun di aplikasi.
--
-- Ganti 'admin1' & password sebelum dijalankan:
--
-- select id from auth.users; -- cari user yang sudah dibuat di Authentication
-- insert into public.profiles (id, username, nama)
-- values ('<uuid-user-tsb>', 'admin1', 'Nama Admin');
-- ---------------------------------------------------------
