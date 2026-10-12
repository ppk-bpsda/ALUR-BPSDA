-- =========================================================
-- Menu "Pengaturan Aplikasi" -- supaya Nama SKPD (dan pengaturan
-- dokumen lain di masa depan) bisa diubah langsung dari aplikasi
-- (edit/simpan), tanpa perlu ubah environment variable di Vercel atau
-- minta developer redeploy setiap kali ada revisi.
--
-- Selama ini Nota Dinas/SPP membaca NEXT_PUBLIC_NAMA_SKPD (env var) dan
-- Kwitansi membaca variabel 2-baris terpisah yang belum sempat di-set
-- di Vercel -- itu sebabnya nilainya bisa beda-beda antar dokumen. Tabel
-- ini jadi SATU sumber kebenaran yang dipakai ketiga dokumen sekaligus.
--
-- Sengaja dibuat sebagai tabel "singleton" (cuma boleh ada 1 baris,
-- id selalu = 1) karena pengaturan ini berlaku untuk seluruh aplikasi,
-- bukan per tahun/tahapan.
-- =========================================================

create table if not exists pengaturan_aplikasi (
  id int primary key default 1,
  nama_skpd_baris1 text not null default 'Bagian Perekonomian dan Sumber Daya Alam',
  nama_skpd_baris2 text not null default 'Sekretariat Daerah Kota Batu',
  updated_at timestamptz not null default now(),
  constraint pengaturan_aplikasi_singleton check (id = 1)
);

insert into pengaturan_aplikasi (id) values (1) on conflict (id) do nothing;

alter table pengaturan_aplikasi enable row level security;
create policy "admin full access" on pengaturan_aplikasi for all to authenticated using (true) with check (true);
