-- =========================================================
-- ANGGARAN KAS per belanja (rekening) per TRIWULAN
-- =========================================================
-- 1 baris = 1 baris DPA (rekening + tahun + tahapan), sehingga anggaran kas
-- otomatis mengikuti tahapan (Murni / Pergeseran / Perubahan). Tabel BARU;
-- tidak mengubah data/tabel yang ada. Aman dijalankan berulang.
-- Total TW1-TW4 idealnya = pagu DPA; aplikasi memberi peringatan bila selisih.

create table if not exists public.anggaran_kas (
  id uuid primary key default gen_random_uuid(),
  dpa_id uuid not null unique references public.dpa(id) on delete cascade,
  tw1 numeric(18,2) not null default 0 check (tw1 >= 0),
  tw2 numeric(18,2) not null default 0 check (tw2 >= 0),
  tw3 numeric(18,2) not null default 0 check (tw3 >= 0),
  tw4 numeric(18,2) not null default 0 check (tw4 >= 0),
  updated_at timestamptz not null default now()
);

alter table public.anggaran_kas enable row level security;
drop policy if exists "admin only" on public.anggaran_kas;
create policy "admin only" on public.anggaran_kas
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
