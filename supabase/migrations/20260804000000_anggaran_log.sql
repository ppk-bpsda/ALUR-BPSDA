-- =========================================================
-- RIWAYAT PERUBAHAN PAGU (jejak audit)
-- =========================================================
-- Setiap penambahan/perubahan pagu -- manual di menu Rekening & Pagu
-- maupun lewat unggah Excel -- dicatat di sini: siapa, kapan, tahapan apa,
-- pagu lama -> baru. Tabel BARU; tidak mengubah data/tabel yang ada.
-- Aman dijalankan berulang. Tanpa tabel ini aplikasi tetap berjalan
-- (hanya panel "Riwayat perubahan" yang kosong).

create table if not exists public.anggaran_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  username text,
  tahun_anggaran int not null,
  tahapan text not null,
  sumber text not null check (sumber in ('manual', 'excel', 'salin')),
  aksi text not null check (aksi in ('tambah', 'ubah', 'hapus')),
  rekening_id uuid,                 -- tanpa FK: riwayat tetap ada walau rekening dihapus
  kode_rekening text,
  sumber_dana text,
  pagu_lama numeric(18,2),
  pagu_baru numeric(18,2),
  keterangan text
);

create index if not exists idx_anggaran_log_waktu on public.anggaran_log (created_at desc);
create index if not exists idx_anggaran_log_periode on public.anggaran_log (tahun_anggaran, tahapan);

alter table public.anggaran_log enable row level security;
drop policy if exists "admin only" on public.anggaran_log;
create policy "admin only" on public.anggaran_log
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
