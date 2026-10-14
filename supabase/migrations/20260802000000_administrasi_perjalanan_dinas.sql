-- =========================================================
-- ADMINISTRASI PERJALANAN DINAS (Kuitansi SPPD)
-- =========================================================
-- Migrasi ini HANYA MENAMBAH objek baru (semua berawalan perjadin_) dan
-- 1 kolom cache email di profiles (percepat login). TIDAK mengubah, memindah,
-- atau menghapus data/tabel yang sudah ada. Aman dijalankan berulang.
--
-- Prasyarat: migrasi 20260801000000_hardening_rls_admin_only.sql sudah dijalankan
-- (fungsi public.is_admin()). Fungsi di bawah identik dgn versi itu.
-- =========================================================

-- 0) Percepat login: simpan email Auth di profiles (1 query, bukan 2 panggilan berurutan)
alter table public.profiles add column if not exists email text;
update public.profiles p set email = lower(u.email)
  from auth.users u where u.id = p.id and (p.email is null or p.email = '');

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles p where p.id = auth.uid()); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 1) Data Pegawai (pelaksana perjalanan dinas)
create table if not exists public.perjadin_pegawai (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  nip text not null,
  pangkat_gol text,
  jabatan text,
  urut int,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint perjadin_pegawai_nip_key unique (nip)
);

-- 2) SBU Uang Harian per tujuan (provinsi) per tahun anggaran
create table if not exists public.perjadin_sbu (
  id uuid primary key default gen_random_uuid(),
  tahun_anggaran int not null default 2026,
  tujuan text not null,
  satuan text not null default 'Orang / Hari',
  uang_harian_rapat numeric(18,2) not null default 0,
  uang_harian_diklat numeric(18,2) not null default 0,
  uang_harian_perjalanan numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint perjadin_sbu_tujuan_tahun_key unique (tahun_anggaran, tujuan)
);

-- 3) Administrasi perjalanan dinas (1 Surat Tugas = 1 baris)
create table if not exists public.perjadin (
  id uuid primary key default gen_random_uuid(),
  tahun_anggaran int not null,
  nomor_surat_tugas text,
  tanggal_surat_tugas date,
  maksud text not null,
  tujuan_kota text,
  tujuan_provinsi text,
  tanggal_berangkat date not null,
  tanggal_kembali date not null,
  lama_hari int not null check (lama_hari >= 1),
  jenis_tarif text not null default 'perjalanan' check (jenis_tarif in ('perjalanan','rapat','diklat')),
  tarif_uang_harian numeric(18,2) not null default 0,
  biaya_lain jsonb not null default '[]'::jsonb,
  dpa_id uuid references public.dpa(id) on delete set null,
  tanggal_kuitansi date,
  nomor_kuitansi text,
  surat_tugas_path text,
  surat_tugas_nama text,
  laporan_path text,
  laporan_nama text,
  hasil_ekstraksi jsonb,
  dibuat_oleh uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_perjadin_tahun on public.perjadin (tahun_anggaran, tanggal_berangkat desc);

-- 4) Peserta (snapshot data pegawai saat kuitansi dibuat)
create table if not exists public.perjadin_peserta (
  id uuid primary key default gen_random_uuid(),
  perjadin_id uuid not null references public.perjadin(id) on delete cascade,
  pegawai_id uuid references public.perjadin_pegawai(id) on delete set null,
  nama text not null,
  nip text,
  pangkat_gol text,
  jabatan text,
  urut int not null default 0
);
create index if not exists idx_perjadin_peserta_perjadin on public.perjadin_peserta (perjadin_id);

-- 5) RLS: hanya admin terdaftar (pola sama dgn tabel lain)
do $$
declare t text;
begin
  foreach t in array array['perjadin_pegawai','perjadin_sbu','perjadin','perjadin_peserta'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin only" on public.%I', t);
    execute format('create policy "admin only" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- 6) Bucket penyimpanan berkas (privat) untuk Surat Tugas & Laporan
insert into storage.buckets (id, name, public, file_size_limit)
values ('perjalanan-dinas', 'perjalanan-dinas', false, 4194304)
on conflict (id) do nothing;

drop policy if exists "perjadin berkas admin" on storage.objects;
create policy "perjadin berkas admin" on storage.objects
  for all to authenticated
  using (bucket_id = 'perjalanan-dinas' and public.is_admin())
  with check (bucket_id = 'perjalanan-dinas' and public.is_admin());

-- 7) Data awal dari file lampiran (hanya diisi bila belum ada)
insert into public.perjadin_pegawai (nama, nip, pangkat_gol, jabatan, urut) values
  ('Dra. Emilyati, M.Si.', '196901181990032002', 'Pembina Tk.I - IV/b', 'Kepala Bagian', 1),
  ('Tengko Wolok, S.T.', '197504282005011006', 'Penata Tk. I - III/d', 'Analis Kebijakan Ahli Muda', 2),
  ('Sari Anas Putri, S.E.', '198104252005012021', 'Penata Tk. I - III/d', 'Analis Kebijakan Ahli Muda', 3),
  ('Diyah Wahyuni, S.E., M.M.', '197702182007012011', 'Penata Tk. I - III/d', 'Analis Kebijakan Ahli Muda', 4),
  ('Supriyati, S.S.', '197804052007012014', 'Penata Tk. I - III/d', 'Penelaah Teknis Kebijakan', 5),
  ('Wiwit Pandewanti, S.E.', '197007142008012013', 'Penata Tk. I - III/d', 'Penelaah Teknis Kebijakan', 6),
  ('Nur Wahidah Chotib, S.E., M.M.', '197512182010012005', 'Penata Tk. I - III/d', 'Penelaah Teknis Kebijakan', 7),
  ('Khusnul Rofi''iyah, S.E., M.M.', '198202222010012015', 'Penata Tk. I - III/d', 'Penelaah Teknis Kebijakan', 8),
  ('Moch. Sofuwan, A.Md.', '197712272010011014', 'Penata - III/c', 'Penelaah Teknis Kebijakan', 9),
  ('Andita Putra Perdana, S.E., S.AB.', '198407082011011005', 'Penata Muda Tk. I - III/b', 'Penelaah Teknis Kebijakan', 10),
  ('Kiki Isnandar S.Kom.', '198412182011011006', 'Penata Muda Tk. I - III/b', 'Penelaah Teknis Kebijakan', 11),
  ('Irsya Yuristin', '198307282011012004', 'Penata Muda - III/a', 'Penelaah Teknis Kebijakan', 12),
  ('Emalia Liestyaningtias Saputri, S.E.', '198102152025212006', 'PPTK - Gol. IX', 'Analis Kebijakan Ahli Pertama', 13),
  ('Yuerni, S.AP.', '198410122024212016', 'PPTK - Gol. IX', 'Perencana Ahli Pertama', 14),
  ('Astilina Pranawaningtyas', '198404222025212006', 'PPTK - Gol.V', 'Administrasi Perkantoran', 15),
  ('Lelytha Chaironi', '197107212025212001', 'PPTK - Gol.V', 'Administrasi Perkantoran', 16),
  ('Olivia Ulfa', '197802042025212033', 'PPTK PW', 'Operator Layanan Operasional', 17),
  ('Deri Firmansyah', '199612142025211061', 'PPTK PW', 'Operator Layanan Operasional', 18)
on conflict (nip) do nothing;

insert into public.perjadin_sbu (tujuan, satuan, uang_harian_rapat, uang_harian_diklat, uang_harian_perjalanan) values
  ('Kota Batu', 'Orang / Hari', 140000, 0, 0),
  ('Aceh', 'Orang / Hari', 120000, 110000, 360000),
  ('Bali', 'Orang / Hari', 160000, 140000, 480000),
  ('Bangka Belitung', 'Orang / Hari', 130000, 120000, 410000),
  ('Banten', 'Orang / Hari', 120000, 110000, 370000),
  ('Bengkulu', 'Orang / Hari', 130000, 110000, 380000),
  ('DI Yogyakarta', 'Orang / Hari', 140000, 130000, 420000),
  ('DKI Jakarta', 'Orang / Hari', 180000, 160000, 530000),
  ('Gorontalo', 'Orang / Hari', 130000, 110000, 370000),
  ('Jambi', 'Orang / Hari', 130000, 110000, 370000),
  ('Jawa Barat', 'Orang / Hari', 150000, 130000, 430000),
  ('Jawa Tengah', 'Orang / Hari', 130000, 110000, 370000),
  ('Jawa Timur', 'Orang / Hari', 140000, 120000, 410000),
  ('Kalimantan Barat', 'Orang / Hari', 130000, 110000, 380000),
  ('Kalimantan Selatan', 'Orang / Hari', 130000, 110000, 380000),
  ('Kalimantan Tengah', 'Orang / Hari', 120000, 110000, 360000),
  ('Kalimantan Timur', 'Orang / Hari', 150000, 130000, 430000),
  ('Kalimantan Utara', 'Orang / Hari', 150000, 130000, 430000),
  ('Kepulauan Riau', 'Orang / Hari', 130000, 110000, 370000),
  ('Lampung', 'Orang / Hari', 130000, 110000, 380000),
  ('Maluku', 'Orang / Hari', 120000, 110000, 380000),
  ('Maluku Utara', 'Orang / Hari', 130000, 130000, 430000),
  ('Nusa Tenggara Barat', 'Orang / Hari', 150000, 130000, 440000),
  ('Nusa Tenggara Timur', 'Orang / Hari', 140000, 130000, 430000),
  ('Papua', 'Orang / Hari', 200000, 170000, 580000),
  ('Papua Barat', 'Orang / Hari', 160000, 140000, 480000),
  ('Riau', 'Orang / Hari', 130000, 110000, 370000),
  ('Sulawesi Barat', 'Orang / Hari', 120000, 120000, 410000),
  ('Sulawesi Selatan', 'Orang / Hari', 150000, 130000, 430000),
  ('Sulawesi Tengah', 'Orang / Hari', 130000, 110000, 370000),
  ('Sulawesi Tenggara', 'Orang / Hari', 130000, 110000, 380000),
  ('Sulawesi Utara', 'Orang / Hari', 130000, 110000, 370000),
  ('Sumatera Barat', 'Orang / Hari', 120000, 110000, 380000),
  ('Sumatera Selatan', 'Orang / Hari', 120000, 110000, 380000),
  ('Sumatera Utara', 'Orang / Hari', 130000, 110000, 370000)
on conflict (tahun_anggaran, tujuan) do nothing;
