-- =========================================================
-- SCHEMA v2 -- Aplikasi Pendamping SPJ
-- Perubahan dari v1 (20260714000001_init_schema.sql):
--   1) HANYA SATU JENIS AKUN: Admin. Semua yang login dianggap admin,
--      jadi RLS disederhanakan (tidak ada lagi role PPTK/KPA/Bendahara
--      yang login terpisah -- mereka cuma nama+NIP di master data,
--      diinput manual oleh Admin dan dipakai untuk mengisi dokumen).
--   2) Tabel `pegawai` LAMA dihapus dari alur PPTK -- nama & NIP PPTK
--      sekarang langsung melekat di tabel `pptk` per sub kegiatan
--      (lebih simpel sesuai kebutuhan: admin isi manual & update saja).
--   3) Tabel baru `pejabat_skpd` untuk KPA & Bendahara Pengeluaran
--      Pembantu (biasanya satu orang per jabatan per tahun, dipakai
--      di semua dokumen SKPD tsb).
--   4) Tabel baru `penyedia` (penyedia barang/jasa) dan `penerima`
--      (penerima uang GU) -- keduanya "cari & pilih", tapi kalau nama
--      belum ada, diinput manual sekali lalu tersimpan utk dipakai lagi.
--   5) `pengajuan_belanja` ditambah kolom penyedia_id & penerima_id.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- MASTER: STRUKTUR ANGGARAN (sama seperti v1)
-- ---------------------------------------------------------
create table program (
  id uuid primary key default gen_random_uuid(),
  kode_program varchar(20) not null,
  nama_program text not null,
  tahun_anggaran int not null,
  unique (kode_program, tahun_anggaran)
);

create table kegiatan (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references program(id) on delete cascade,
  kode_kegiatan varchar(30) not null,
  nama_kegiatan text not null,
  tahun_anggaran int not null,
  unique (kode_kegiatan, tahun_anggaran)
);

create table sub_kegiatan (
  id uuid primary key default gen_random_uuid(),
  kegiatan_id uuid not null references kegiatan(id) on delete cascade,
  kode_sub_kegiatan varchar(40) not null,
  nama_sub_kegiatan text not null,
  tahun_anggaran int not null,
  unique (kode_sub_kegiatan, tahun_anggaran)
);

create table rekening_belanja (
  id uuid primary key default gen_random_uuid(),
  sub_kegiatan_id uuid not null references sub_kegiatan(id) on delete cascade,
  kode_rekening varchar(60) not null,
  jenis_belanja text not null,
  kelompok_belanja text,
  sumber_dana text not null,
  keterangan text,
  unique (sub_kegiatan_id, kode_rekening, sumber_dana)
);

create index idx_rekening_kode on rekening_belanja (kode_rekening);

-- ---------------------------------------------------------
-- MASTER: PEJABAT SKPD (KPA & Bendahara Pengeluaran Pembantu)
-- Diinput & diupdate manual oleh Admin. Biasanya 1 baris per jabatan
-- per tahun anggaran (kalau ganti pejabat di tengah tahun, tinggal
-- update baris yang ada -- histori lama tidak otomatis tersimpan
-- kecuali Admin sengaja menambah baris baru dgn tahun berbeda).
-- ---------------------------------------------------------
create type jabatan_skpd as enum ('KPA', 'BENDAHARA_PENGELUARAN_PEMBANTU');

create table pejabat_skpd (
  id uuid primary key default gen_random_uuid(),
  jabatan jabatan_skpd not null,
  nama text not null,
  nip varchar(30) not null,
  tahun_anggaran int not null,
  updated_at timestamptz not null default now(),
  unique (jabatan, tahun_anggaran)
);

-- ---------------------------------------------------------
-- PPTK -- nama & NIP langsung di sini (diinput/diupdate manual Admin
-- per sub kegiatan). Tidak lagi lewat tabel pegawai terpisah.
-- ---------------------------------------------------------
create table pptk (
  id uuid primary key default gen_random_uuid(),
  sub_kegiatan_id uuid not null references sub_kegiatan(id),
  nama text not null,
  nip varchar(30) not null,
  nomor_sk text,
  tanggal_sk date,
  tahun_anggaran int not null,
  updated_at timestamptz not null default now(),
  unique (sub_kegiatan_id, tahun_anggaran)
);

-- ---------------------------------------------------------
-- MASTER: PENYEDIA BARANG/JASA -- dicari & dipilih; kalau belum ada,
-- input manual sekali lalu tersimpan untuk dipakai berikutnya.
-- ---------------------------------------------------------
create table penyedia (
  id uuid primary key default gen_random_uuid(),
  nama_penyedia text not null,
  nama_direktur text,
  alamat text,
  npwp varchar(30),
  rekening_bank text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (nama_penyedia)
);

-- ---------------------------------------------------------
-- MASTER: PENERIMA (penerima uang GU / kwitansi) -- dicari & dipilih
-- sama seperti Penyedia.
-- ---------------------------------------------------------
create table penerima (
  id uuid primary key default gen_random_uuid(),
  nama_penerima text not null,
  keterangan text,          -- mis. jabatan/unit, opsional
  created_at timestamptz not null default now(),
  unique (nama_penerima)
);

-- ---------------------------------------------------------
-- DPA & PAGU ANGGARAN
-- ---------------------------------------------------------
create type tahapan_dpa as enum ('murni', 'pergeseran', 'perubahan');

create table dpa (
  id uuid primary key default gen_random_uuid(),
  rekening_id uuid not null references rekening_belanja(id),
  tahun_anggaran int not null,
  tahapan tahapan_dpa not null,
  pagu_anggaran numeric(18,2) not null,
  nomor_dpa text,
  tanggal_penetapan date,
  pptk_id uuid references pptk(id),
  unique (rekening_id, tahun_anggaran, tahapan)
);

-- ---------------------------------------------------------
-- TRANSAKSI: PENGAJUAN BELANJA (inti SPJ)
-- ---------------------------------------------------------
create type status_pengajuan as enum ('draft','diajukan','disetujui','dicairkan','ditolak');

create table pengajuan_belanja (
  id uuid primary key default gen_random_uuid(),
  dpa_id uuid not null references dpa(id),
  nomor_bukti text,
  nomor_nota_dinas text,
  tanggal date not null,
  uraian_kegiatan text not null,
  jumlah_pengajuan numeric(18,2) not null,
  penyedia_id uuid references penyedia(id),   -- opsional: kalau belanja lewat penyedia
  penerima_id uuid references penerima(id),   -- opsional: penerima uang GU
  status status_pengajuan not null default 'draft',
  dibuat_oleh uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_pengajuan_dpa on pengajuan_belanja (dpa_id);
create index idx_pengajuan_status on pengajuan_belanja (status);

create table rincian_belanja (
  id uuid primary key default gen_random_uuid(),
  pengajuan_id uuid not null references pengajuan_belanja(id) on delete cascade,
  nama_item text not null,
  qty numeric(10,2) not null,
  satuan text not null,
  harga_satuan numeric(18,2) not null,
  subtotal numeric(18,2) generated always as (qty * harga_satuan) stored
);

create table potongan_pajak (
  id uuid primary key default gen_random_uuid(),
  pengajuan_id uuid not null references pengajuan_belanja(id) on delete cascade,
  jenis_pajak text not null,
  persentase numeric(5,2),
  nominal numeric(18,2) not null
);

-- ---------------------------------------------------------
-- OUTPUT DOKUMEN
-- ---------------------------------------------------------
create type jenis_dokumen as enum ('nota_dinas','spp_sptjb','kwitansi_gu');

create table dokumen_output (
  id uuid primary key default gen_random_uuid(),
  pengajuan_id uuid not null references pengajuan_belanja(id),
  jenis jenis_dokumen not null,
  nomor_dokumen text,
  file_url text,
  generated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- VIEW: REKAP REALISASI & SISA ANGGARAN
-- ---------------------------------------------------------
create view rekap_realisasi as
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
  coalesce(sum(p.jumlah_pengajuan) filter (where p.status in ('disetujui','dicairkan')), 0) as total_realisasi,
  d.pagu_anggaran - coalesce(sum(p.jumlah_pengajuan) filter (where p.status in ('disetujui','dicairkan')), 0) as sisa_anggaran
from dpa d
join rekening_belanja r on r.id = d.rekening_id
join sub_kegiatan sk on sk.id = r.sub_kegiatan_id
left join pengajuan_belanja p on p.dpa_id = d.id
group by d.id, sk.kode_sub_kegiatan, sk.nama_sub_kegiatan, r.kode_rekening, r.jenis_belanja,
         r.sumber_dana, d.tahun_anggaran, d.tahapan, d.pagu_anggaran;

-- ---------------------------------------------------------
-- ROW LEVEL SECURITY -- disederhanakan: hanya 1 jenis akun (Admin).
-- Siapa pun yang berhasil login (authenticated) dianggap Admin dan
-- boleh baca/tulis semua data. Kalau nanti Anda ingin menambah akun
-- non-admin read-only, tinggal buat policy select-only terpisah.
-- ---------------------------------------------------------
alter table program enable row level security;
alter table kegiatan enable row level security;
alter table sub_kegiatan enable row level security;
alter table rekening_belanja enable row level security;
alter table pejabat_skpd enable row level security;
alter table pptk enable row level security;
alter table penyedia enable row level security;
alter table penerima enable row level security;
alter table dpa enable row level security;
alter table pengajuan_belanja enable row level security;
alter table rincian_belanja enable row level security;
alter table potongan_pajak enable row level security;
alter table dokumen_output enable row level security;

create policy "admin full access" on program for all to authenticated using (true) with check (true);
create policy "admin full access" on kegiatan for all to authenticated using (true) with check (true);
create policy "admin full access" on sub_kegiatan for all to authenticated using (true) with check (true);
create policy "admin full access" on rekening_belanja for all to authenticated using (true) with check (true);
create policy "admin full access" on pejabat_skpd for all to authenticated using (true) with check (true);
create policy "admin full access" on pptk for all to authenticated using (true) with check (true);
create policy "admin full access" on penyedia for all to authenticated using (true) with check (true);
create policy "admin full access" on penerima for all to authenticated using (true) with check (true);
create policy "admin full access" on dpa for all to authenticated using (true) with check (true);
create policy "admin full access" on pengajuan_belanja for all to authenticated using (true) with check (true);
create policy "admin full access" on rincian_belanja for all to authenticated using (true) with check (true);
create policy "admin full access" on potongan_pajak for all to authenticated using (true) with check (true);
create policy "admin full access" on dokumen_output for all to authenticated using (true) with check (true);

-- NOTE: karena hanya Admin yang punya akun, JANGAN aktifkan sign-up publik
-- di Supabase Auth. Buat akun admin manual lewat dashboard Supabase
-- (Authentication > Add User), lalu bagikan kredensialnya ke Admin saja.
