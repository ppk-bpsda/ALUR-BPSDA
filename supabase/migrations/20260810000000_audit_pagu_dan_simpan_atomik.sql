-- =========================================================
-- AUDIT PAGU OTOMATIS + PENJAGA KODE REKENING + SIMPAN ATOMIK
-- =========================================================
-- Masalah yang diperbaiki
--   1) Salah input kode rekening sulit dilacak: riwayat lama (anggaran_log)
--      hanya mencatat perubahan PAGU lewat Excel. Perubahan kode/uraian/
--      sumber dana di menu Rekening, hapus, dan salin tahapan TIDAK tercatat.
--   2) Pencatatan dilakukan aplikasi dan gagal diam-diam; bisa terlewat.
--   3) Simpan Excel dilakukan baris demi baris (lambat, bisa setengah jadi).
--
-- Solusi (semua di database, jadi berlaku untuk SEMUA jalur: halaman web,
-- unggah Excel, bahkan SQL Editor):
--   a) Trigger audit pada rekening_belanja & dpa -> anggaran_log berisi
--      siapa, kapan, nilai SEBELUM & SESUDAH (kode, uraian, sumber dana,
--      sub kegiatan, pagu, PPTK) + kolom apa yang berubah.
--   b) Trigger penjaga: kode rekening baru/diubah wajib berawalan kode sub
--      kegiatannya + 6 segmen kode belanja; sumber dana dirapikan
--      (spasi, huruf besar/kecil mengikuti katalog).
--   c) Fungsi terapkan_pagu(): satu transaksi (gagal = tidak ada yang
--      berubah), dengan pengecekan konflik bila pagu sudah diubah orang lain
--      sejak pratinjau. Fungsi salin_pagu_tahapan() untuk salin antar tahapan.
--   d) anggaran_log menjadi append-only (tidak bisa diubah/dihapus dari browser).
--
-- Aman dijalankan berulang. TIDAK mengubah/menghapus data pagu yang sudah ada.
-- Prasyarat: 20260801000000 (is_admin) dan 20260804000000 (anggaran_log).
-- =========================================================

do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'Fungsi public.is_admin() belum ada. Jalankan dulu migrasi 20260801000000_hardening_rls_admin_only.sql.';
  end if;
  if to_regclass('public.anggaran_log') is null then
    raise exception 'Tabel anggaran_log belum ada. Jalankan dulu migrasi 20260804000000_anggaran_log.sql.';
  end if;
end $$;

-- ---------------------------------------------------------
-- 1) PERLUAS anggaran_log + tabel induk impor (anggaran_batch)
-- ---------------------------------------------------------
create table if not exists public.anggaran_batch (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  user_id      uuid,
  username     text,
  tahun_anggaran int not null,
  tahapan      text not null,
  sumber       text not null,
  nama_berkas  text,
  ringkasan    jsonb
);
create index if not exists idx_anggaran_batch_waktu on public.anggaran_batch (created_at desc);

alter table public.anggaran_log add column if not exists batch_id uuid;
alter table public.anggaran_log add column if not exists nama_berkas text;
alter table public.anggaran_log add column if not exists nomor_baris int;
alter table public.anggaran_log add column if not exists tabel text;            -- 'dpa' | 'rekening_belanja' (null = data lama = dpa)
alter table public.anggaran_log add column if not exists kolom_berubah text[];
alter table public.anggaran_log add column if not exists sebelum jsonb;
alter table public.anggaran_log add column if not exists sesudah jsonb;

alter table public.anggaran_log drop constraint if exists anggaran_log_sumber_check;
alter table public.anggaran_log add constraint anggaran_log_sumber_check
  check (sumber in ('manual', 'excel', 'salin', 'sistem'));

create index if not exists idx_anggaran_log_batch   on public.anggaran_log (batch_id) where batch_id is not null;
create index if not exists idx_anggaran_log_kode    on public.anggaran_log (kode_rekening);
create index if not exists idx_anggaran_log_rek     on public.anggaran_log (rekening_id);

-- Append-only: browser hanya boleh MEMBACA. Penulisan hanya lewat trigger/fungsi di bawah.
alter table public.anggaran_batch enable row level security;
drop policy if exists "admin only" on public.anggaran_log;
drop policy if exists "admin read" on public.anggaran_log;
create policy "admin read" on public.anggaran_log for select to authenticated using (public.is_admin());
drop policy if exists "admin read" on public.anggaran_batch;
create policy "admin read" on public.anggaran_batch for select to authenticated using (public.is_admin());
revoke all on public.anggaran_log, public.anggaran_batch from anon, authenticated;
grant select on public.anggaran_log, public.anggaran_batch to authenticated;

-- ---------------------------------------------------------
-- 2) TRIGGER AUDIT (rekening_belanja & dpa)
-- ---------------------------------------------------------
create or replace function public.audit_anggaran()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_kolom text[];
  v_penting text[];
  v_uid uuid := auth.uid();
  v_user text;
  v_rek_id uuid;
  v_kode text;
  v_sumber_dana text;
  v_tahun int;
  v_tahapan text;
  v_batch uuid := nullif(current_setting('app.batch_id', true), '')::uuid;
begin
  if tg_table_name = 'dpa' then
    v_penting := array['rekening_id','tahun_anggaran','tahapan','pagu_anggaran','pptk_id'];
  else
    v_penting := array['sub_kegiatan_id','kode_rekening','jenis_belanja','kelompok_belanja','sumber_dana','keterangan'];
  end if;

  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_kolom
    from jsonb_object_keys(v_new) k
    where k = any (v_penting) and (v_old -> k) is distinct from (v_new -> k);
    if v_kolom is null then return null; end if;   -- tidak ada perubahan penting (mis. hanya tanggal penetapan)
  end if;

  if tg_table_name = 'dpa' then
    v_rek_id := (v_row ->> 'rekening_id')::uuid;
    v_tahun := (v_row ->> 'tahun_anggaran')::int;
    v_tahapan := v_row ->> 'tahapan';
    select r.kode_rekening, r.sumber_dana into v_kode, v_sumber_dana from rekening_belanja r where r.id = v_rek_id;
  else
    v_rek_id := (v_row ->> 'id')::uuid;
    v_kode := v_row ->> 'kode_rekening';
    v_sumber_dana := v_row ->> 'sumber_dana';
    select s.tahun_anggaran into v_tahun from sub_kegiatan s where s.id = (v_row ->> 'sub_kegiatan_id')::uuid;
    v_tahapan := 'semua';
  end if;

  if v_uid is not null then
    select p.username into v_user from profiles p where p.id = v_uid;
  end if;

  insert into anggaran_log (
    user_id, username, tahun_anggaran, tahapan, sumber, aksi, rekening_id, kode_rekening, sumber_dana,
    pagu_lama, pagu_baru, batch_id, nama_berkas, nomor_baris, tabel, kolom_berubah, sebelum, sesudah, keterangan
  ) values (
    v_uid, coalesce(v_user, case when v_uid is null then 'SQL/sistem' end),
    coalesce(v_tahun, 0), coalesce(v_tahapan, '-'),
    coalesce(nullif(current_setting('app.sumber', true), ''), 'manual'),
    case tg_op when 'INSERT' then 'tambah' when 'UPDATE' then 'ubah' else 'hapus' end,
    v_rek_id, v_kode, v_sumber_dana,
    case when tg_table_name = 'dpa' and v_old is not null then (v_old ->> 'pagu_anggaran')::numeric end,
    case when tg_table_name = 'dpa' and v_new is not null then (v_new ->> 'pagu_anggaran')::numeric end,
    v_batch,
    nullif(current_setting('app.nama_berkas', true), ''),
    nullif(current_setting('app.nomor_baris', true), '')::int,
    tg_table_name, v_kolom, v_old, v_new,
    case when tg_table_name = 'rekening_belanja' and tg_op = 'UPDATE'
         then 'Master rekening diubah (berlaku untuk semua tahapan)' end
  );
  return null;
end $$;

drop trigger if exists trg_audit_dpa on public.dpa;
create trigger trg_audit_dpa after insert or update or delete on public.dpa
  for each row execute function public.audit_anggaran();
drop trigger if exists trg_audit_rekening on public.rekening_belanja;
create trigger trg_audit_rekening after insert or update or delete on public.rekening_belanja
  for each row execute function public.audit_anggaran();

-- ---------------------------------------------------------
-- 3) TRIGGER PENJAGA rekening_belanja (sebelum simpan)
-- ---------------------------------------------------------
create or replace function public.jaga_rekening_belanja()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_kode_sub text;
  v_kanon text;
begin
  -- rapikan teks: spasi ganda/ujung, NBSP hasil salin dari Excel/PDF
  new.kode_rekening := btrim(regexp_replace(new.kode_rekening, '[\s\u00a0]+', '', 'g'));
  new.sumber_dana   := btrim(regexp_replace(new.sumber_dana,   '[\s\u00a0]+', ' ', 'g'));
  new.jenis_belanja := btrim(regexp_replace(new.jenis_belanja, '[\s\u00a0]+', ' ', 'g'));

  -- samakan penulisan sumber dana dengan katalog (mencegah 'PAD' dan 'pad ' jadi dua rekening)
  select s.nama into v_kanon from ref_sumber_dana s
   where lower(btrim(s.nama)) = lower(new.sumber_dana) limit 1;
  if v_kanon is not null then new.sumber_dana := btrim(v_kanon); end if;

  if new.sumber_dana = '' then raise exception 'Sumber dana wajib diisi.'; end if;

  -- validasi hanya saat baris baru atau kode/sub kegiatan diubah (data lama tidak dipaksa)
  if tg_op = 'INSERT'
     or new.kode_rekening is distinct from old.kode_rekening
     or new.sub_kegiatan_id is distinct from old.sub_kegiatan_id then
    select kode_sub_kegiatan into v_kode_sub from sub_kegiatan where id = new.sub_kegiatan_id;
    if v_kode_sub is null then raise exception 'Sub kegiatan tidak ditemukan.'; end if;
    if left(new.kode_rekening, length(v_kode_sub) + 1) <> v_kode_sub || '.'
       or substr(new.kode_rekening, length(v_kode_sub) + 2) !~ '^[0-9]\.[0-9]\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}\.[0-9]{5}$' then
      raise exception 'Kode rekening % tidak valid: harus berformat %.X.X.XX.XX.XXX.XXXXX (kode sub kegiatan + kode belanja 6 segmen).',
        new.kode_rekening, v_kode_sub;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_jaga_rekening on public.rekening_belanja;
create trigger trg_jaga_rekening before insert or update on public.rekening_belanja
  for each row execute function public.jaga_rekening_belanja();

-- Pagu tidak boleh negatif (NOT VALID: hanya berlaku untuk data baru/diubah; data lama tidak diperiksa ulang)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dpa_pagu_tidak_negatif') then
    alter table public.dpa add constraint dpa_pagu_tidak_negatif check (pagu_anggaran >= 0) not valid;
  end if;
end $$;

-- ---------------------------------------------------------
-- 4) terapkan_pagu(): simpan hasil pratinjau Excel dalam SATU transaksi
-- ---------------------------------------------------------
create or replace function public.terapkan_pagu(
  p_tahun int, p_tahapan text, p_baris jsonb, p_nama_berkas text default null, p_ringkasan jsonb default null
) returns jsonb
language plpgsql
security definer   -- perlu menulis tabel riwayat yang append-only; akses dijaga is_admin() di bawah
set search_path = public
as $$
declare
  v_tahapan tahapan_dpa := p_tahapan::tahapan_dpa;   -- nilai di luar enum -> error jelas
  v_uid uuid := auth.uid();
  v_user text;
  v_batch uuid := gen_random_uuid();
  v_tgl date;
  r jsonb;
  v_prog uuid; v_keg uuid; v_sub uuid; v_rek uuid; v_dpa record;
  v_pagu numeric(18,2);
  v_pptk uuid;
  h jsonb := jsonb_build_object('tambah',0,'ubah',0,'sama',0,'subBaru',0,'kegiatanBaru',0,'programBaru',0,'rekeningBaru',0,'koreksi',0);
begin
  if not public.is_admin() then raise exception 'Anda tidak memiliki akses.'; end if;
  if jsonb_typeof(p_baris) <> 'array' or jsonb_array_length(p_baris) = 0 then raise exception 'Tidak ada baris untuk disimpan.'; end if;
  if jsonb_array_length(p_baris) > 5000 then raise exception 'Maksimal 5000 baris per penyimpanan.'; end if;

  select username into v_user from profiles where id = v_uid;
  insert into anggaran_batch (id, user_id, username, tahun_anggaran, tahapan, sumber, nama_berkas, ringkasan)
  values (v_batch, v_uid, v_user, p_tahun, p_tahapan, 'excel', left(p_nama_berkas, 200), p_ringkasan);

  perform set_config('app.batch_id', v_batch::text, true);
  perform set_config('app.sumber', 'excel', true);
  perform set_config('app.nama_berkas', coalesce(left(p_nama_berkas, 200), ''), true);

  select tanggal_penetapan into v_tgl from dpa
   where tahun_anggaran = p_tahun and tahapan = v_tahapan and tanggal_penetapan is not null limit 1;

  for r in select * from jsonb_array_elements(p_baris) loop
    perform set_config('app.nomor_baris', coalesce(r ->> 'baris', ''), true);
    v_pagu := round((r ->> 'pagu_baru')::numeric, 2);
    if v_pagu is null or v_pagu < 0 then raise exception 'Baris %: pagu tidak valid.', r ->> 'baris'; end if;
    v_pptk := nullif(r ->> 'pptk_id', '')::uuid;

    -- program -> kegiatan -> sub kegiatan (dibuat hanya bila belum ada)
    v_sub := null;
    select id into v_sub from sub_kegiatan where kode_sub_kegiatan = r ->> 'kode_sub_kegiatan' and tahun_anggaran = p_tahun;
    if v_sub is null then
      select id into v_keg from kegiatan where kode_kegiatan = r ->> 'kode_kegiatan' and tahun_anggaran = p_tahun;
      if v_keg is null then
        select id into v_prog from program where kode_program = r ->> 'kode_program' and tahun_anggaran = p_tahun;
        if v_prog is null then
          insert into program (kode_program, nama_program, tahun_anggaran)
          values (r ->> 'kode_program', r ->> 'nama_program', p_tahun) returning id into v_prog;
          h := jsonb_set(h, '{programBaru}', to_jsonb((h ->> 'programBaru')::int + 1));
        end if;
        insert into kegiatan (program_id, kode_kegiatan, nama_kegiatan, tahun_anggaran)
        values (v_prog, r ->> 'kode_kegiatan', r ->> 'nama_kegiatan', p_tahun) returning id into v_keg;
        h := jsonb_set(h, '{kegiatanBaru}', to_jsonb((h ->> 'kegiatanBaru')::int + 1));
      end if;
      insert into sub_kegiatan (kegiatan_id, kode_sub_kegiatan, nama_sub_kegiatan, tahun_anggaran)
      values (v_keg, r ->> 'kode_sub_kegiatan', r ->> 'nama_sub_kegiatan', p_tahun) returning id into v_sub;
      h := jsonb_set(h, '{subBaru}', to_jsonb((h ->> 'subBaru')::int + 1));
    end if;

    -- rekening master
    v_rek := nullif(r ->> 'rekening_id', '')::uuid;
    if v_rek is not null and coalesce((r ->> 'koreksi')::boolean, false) then
      -- koreksi kode/uraian/sumber dana atas rekening yang sudah ada (tercatat di riwayat)
      update rekening_belanja set sub_kegiatan_id = v_sub, kode_rekening = r ->> 'kode_rekening',
             jenis_belanja = r ->> 'jenis_belanja', sumber_dana = r ->> 'sumber_dana',
             kelompok_belanja = coalesce(nullif(r ->> 'kelompok_belanja', ''), kelompok_belanja)
       where id = v_rek;
      if not found then raise exception 'Baris %: rekening yang akan dikoreksi tidak ditemukan.', r ->> 'baris'; end if;
      h := jsonb_set(h, '{koreksi}', to_jsonb((h ->> 'koreksi')::int + 1));
    elsif v_rek is null then
      select id into v_rek from rekening_belanja
       where sub_kegiatan_id = v_sub and kode_rekening = r ->> 'kode_rekening' and lower(sumber_dana) = lower(r ->> 'sumber_dana');
      if v_rek is null then
        insert into rekening_belanja (sub_kegiatan_id, kode_rekening, jenis_belanja, kelompok_belanja, sumber_dana)
        values (v_sub, r ->> 'kode_rekening', r ->> 'jenis_belanja', r ->> 'kelompok_belanja', r ->> 'sumber_dana')
        returning id into v_rek;
        h := jsonb_set(h, '{rekeningBaru}', to_jsonb((h ->> 'rekeningBaru')::int + 1));
      end if;
    end if;

    -- pagu (dpa) pada tahapan tujuan; kunci baris agar tidak bentrok dengan pengguna lain
    select id, pagu_anggaran, pptk_id into v_dpa from dpa
     where rekening_id = v_rek and tahun_anggaran = p_tahun and tahapan = v_tahapan for update;
    if found then
      if coalesce((r ->> 'harap_baru')::boolean, false) then
        raise exception 'KONFLIK baris % (%): pagu tahapan ini baru saja dibuat pengguna lain (Rp %). Periksa ulang berkas.',
          r ->> 'baris', r ->> 'kode_rekening', v_dpa.pagu_anggaran;
      end if;
      if (r ->> 'pagu_lama') is not null and v_dpa.pagu_anggaran <> (r ->> 'pagu_lama')::numeric then
        raise exception 'KONFLIK baris % (%): pagu di database sekarang Rp %, sebelumnya Rp % saat pratinjau. Ada yang mengubahnya; periksa ulang berkas.',
          r ->> 'baris', r ->> 'kode_rekening', v_dpa.pagu_anggaran, r ->> 'pagu_lama';
      end if;
      if v_dpa.pagu_anggaran = v_pagu and (v_pptk is null or v_pptk is not distinct from v_dpa.pptk_id) then
        h := jsonb_set(h, '{sama}', to_jsonb((h ->> 'sama')::int + 1));
      else
        update dpa set pagu_anggaran = v_pagu, pptk_id = coalesce(v_pptk, pptk_id) where id = v_dpa.id;
        h := jsonb_set(h, '{ubah}', to_jsonb((h ->> 'ubah')::int + 1));
      end if;
    else
      insert into dpa (rekening_id, tahun_anggaran, tahapan, pagu_anggaran, pptk_id, tanggal_penetapan)
      values (v_rek, p_tahun, v_tahapan, v_pagu, v_pptk, v_tgl);
      h := jsonb_set(h, '{tambah}', to_jsonb((h ->> 'tambah')::int + 1));
    end if;
  end loop;

  update anggaran_batch set ringkasan = coalesce(p_ringkasan, '{}'::jsonb) || jsonb_build_object('hasil', h) where id = v_batch;
  return h || jsonb_build_object('batch_id', v_batch);
end $$;

-- ---------------------------------------------------------
-- 5) salin_pagu_tahapan(): salin pagu antar tahapan (hanya yang belum ada)
-- ---------------------------------------------------------
create or replace function public.salin_pagu_tahapan(p_tahun int, p_dari text, p_ke text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dari tahapan_dpa := p_dari::tahapan_dpa;
  v_ke   tahapan_dpa := p_ke::tahapan_dpa;
  v_uid uuid := auth.uid();
  v_user text;
  v_batch uuid := gen_random_uuid();
  v_tgl date;
  n int;
begin
  if not public.is_admin() then raise exception 'Anda tidak memiliki akses.'; end if;
  if v_dari = v_ke then raise exception 'Tahapan sumber dan tujuan harus berbeda.'; end if;
  select username into v_user from profiles where id = v_uid;
  insert into anggaran_batch (id, user_id, username, tahun_anggaran, tahapan, sumber, nama_berkas)
  values (v_batch, v_uid, v_user, p_tahun, p_ke, 'salin', 'Salin dari ' || p_dari);
  perform set_config('app.batch_id', v_batch::text, true);
  perform set_config('app.sumber', 'salin', true);
  select tanggal_penetapan into v_tgl from dpa
   where tahun_anggaran = p_tahun and tahapan = v_ke and tanggal_penetapan is not null limit 1;
  insert into dpa (rekening_id, tahun_anggaran, tahapan, pagu_anggaran, pptk_id, tanggal_penetapan)
  select s.rekening_id, p_tahun, v_ke, s.pagu_anggaran, s.pptk_id, v_tgl
    from dpa s
   where s.tahun_anggaran = p_tahun and s.tahapan = v_dari
     and not exists (select 1 from dpa t where t.rekening_id = s.rekening_id and t.tahun_anggaran = p_tahun and t.tahapan = v_ke);
  get diagnostics n = row_count;
  update anggaran_batch set ringkasan = jsonb_build_object('ditambah', n) where id = v_batch;
  return n;
end $$;

revoke all on function public.terapkan_pagu(int, text, jsonb, text, jsonb) from public, anon;
revoke all on function public.salin_pagu_tahapan(int, text, text) from public, anon;
grant execute on function public.terapkan_pagu(int, text, jsonb, text, jsonb) to authenticated;
grant execute on function public.salin_pagu_tahapan(int, text, text) to authenticated;
