-- =========================================================================
-- RESET AKUN ADMIN (lupa username / kata sandi)
-- Jalankan di: Supabase Dashboard > SQL Editor.  JANGAN di-commit dengan
-- kata sandi sungguhan di dalamnya.
-- Aman diulang. Hanya MENGUBAH kata sandi; tidak menghapus data apa pun.
-- =========================================================================

-- LANGKAH 1 -- Jalankan blok ini sendiri dulu: lihat SEMUA akun yang ada.
-- Kolom "username" = yang diketik di halaman login.
select p.username, p.nama, u.email, u.created_at, u.last_sign_in_at
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;

-- LANGKAH 2 -- Ubah v_username (sesuai hasil langkah 1) dan v_password
-- (min. 10 karakter, huruf + angka), lalu jalankan blok ini.
do $$
declare
  v_username text := 'admin';                        -- <== username akun yang di-reset
  v_password text := 'GANTI_DENGAN_KATA_SANDI_BARU'; -- <== kata sandi baru
  v_id uuid;
begin
  if v_password = 'GANTI_DENGAN_KATA_SANDI_BARU'
     or length(v_password) < 10
     or v_password !~ '[A-Za-z]' or v_password !~ '[0-9]' then
    raise exception 'Isi v_password dengan kata sandi baru (min. 10 karakter, huruf + angka).';
  end if;

  select u.id into v_id
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(p.username) = lower(v_username)
     or lower(u.email) in (lower(v_username) || '@admin.local',
                           lower(v_username) || '@spj-batu.internal',
                           lower(v_username))
  order by u.created_at
  limit 1;

  if v_id is null then
    raise exception 'Akun "%" tidak ditemukan. Cek hasil LANGKAH 1, atau buat akun baru lewat Authentication > Users > Add user (email: %@admin.local), lalu jalankan skrip ini lagi.', v_username, lower(v_username);
  end if;

  update auth.users
     set encrypted_password = crypt(v_password, gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = v_id;

  -- Pastikan akun punya profil (syarat lolos RLS is_admin()).
  insert into public.profiles (id, username, nama)
  values (v_id, lower(v_username), lower(v_username))
  on conflict (id) do nothing;

  -- Paksa keluar dari semua perangkat yang masih login dengan sandi lama.
  delete from auth.sessions where user_id = v_id;

  raise notice 'Selesai. Login dengan username "%" dan kata sandi baru.', lower(v_username);
end $$;
