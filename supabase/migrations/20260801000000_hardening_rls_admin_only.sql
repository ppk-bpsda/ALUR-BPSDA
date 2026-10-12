-- =========================================================
-- HARDENING KEAMANAN -- RLS hanya untuk akun yang terdaftar sebagai Admin
-- =========================================================
-- Kondisi lama: SEMUA policy bernama "admin full access" memakai
--   using (true) with check (true)  to authenticated
-- artinya SIAPA PUN yang punya sesi Supabase Auth (termasuk orang yang
-- mendaftar sendiri bila "Allow new users to sign up" masih menyala)
-- bisa membaca & mengubah seluruh data anggaran/pengajuan.
--
-- Perubahan:
--   1) Backfill: setiap akun auth.users yang belum punya baris di
--      public.profiles dibuatkan profil (supaya TIDAK ada Admin yang
--      terkunci setelah migrasi ini). TINJAU hasilnya di langkah
--      verifikasi di bawah -- hapus akun yang tidak dikenal.
--   2) Fungsi public.is_admin(): true bila auth.uid() punya baris profiles.
--   3) Semua policy tabel data diganti: hanya is_admin() yang lolos.
--   4) profiles: user hanya boleh MEMBACA (baris sendiri / semua bila
--      admin). Tulis (tambah/ubah/hapus akun) hanya lewat service_role
--      di server action /akun -- bukan dari browser.
--   5) get_login_email() dicabut dari anon: fungsi ini bisa dipakai
--      siapa pun untuk menebak username -> email. Aplikasi tidak
--      memakainya lagi (lookup dilakukan di server).
--   6) Pastikan view rekap_realisasi tetap security_invoker (ada migrasi
--      lanjutan yang me-replace view tersebut).
--
-- AMAN dijalankan berulang (idempotent).
-- =========================================================

-- 1) Backfill profiles --------------------------------------------------
do $$
declare
  r record;
  uname text;
begin
  for r in
    select u.id, u.email
    from auth.users u
    where not exists (select 1 from public.profiles p where p.id = u.id)
  loop
    uname := coalesce(
      nullif(regexp_replace(lower(split_part(coalesce(r.email, ''), '@', 1)), '[^a-z0-9._-]', '', 'g'), ''),
      'admin'
    );
    uname := left(uname, 32);
    if exists (select 1 from public.profiles where username = uname) then
      uname := left(uname, 27) || '-' || substr(r.id::text, 1, 4);
    end if;
    insert into public.profiles (id, username, nama) values (r.id, uname, uname);
  end loop;
end $$;

-- 2) Fungsi is_admin ------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 3) Ganti policy tabel data ---------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'program', 'kegiatan', 'sub_kegiatan', 'rekening_belanja', 'pejabat_skpd',
    'penyedia', 'dpa', 'pengajuan_belanja', 'rincian_belanja', 'potongan_pajak',
    'dokumen_output', 'pengaturan_aplikasi'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "admin full access" on public.%I', t);
      execute format('drop policy if exists "admin only" on public.%I', t);
      execute format(
        'create policy "admin only" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
        t
      );
    end if;
  end loop;
end $$;

-- 4) profiles: baca saja dari sisi user ----------------------------------
alter table public.profiles enable row level security;
drop policy if exists "admin full access" on public.profiles;
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());
-- (sengaja TIDAK ada policy insert/update/delete: hanya service_role yang bisa)

-- 5) Cabut get_login_email dari anon/authenticated -----------------------
do $$
begin
  if to_regprocedure('public.get_login_email(text)') is not null then
    revoke all on function public.get_login_email(text) from public, anon, authenticated;
  end if;
end $$;

-- 6) View rekap tetap security invoker -----------------------------------
do $$
begin
  if to_regclass('public.rekap_realisasi') is not null then
    execute 'alter view public.rekap_realisasi set (security_invoker = true)';
  end if;
end $$;

-- =========================================================
-- VERIFIKASI (jalankan manual setelah migrasi)
-- =========================================================
-- a) Daftar akun yang punya akses (pastikan semuanya dikenal):
--      select p.username, u.email, u.created_at
--      from public.profiles p join auth.users u on u.id = p.id order by u.created_at;
-- b) Tidak ada lagi policy "using (true)":
--      select tablename, policyname, qual from pg_policies
--      where schemaname = 'public' and qual = 'true';
-- c) Di Supabase Dashboard > Authentication > Providers > Email:
--    MATIKAN "Allow new users to sign up".
