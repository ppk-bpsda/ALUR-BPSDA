-- =========================================================
-- Surat Tugas & Laporan Perjalanan Dinas dibuat otomatis dari satu input.
-- Hanya MENAMBAH 2 kolom teks opsional pada tabel perjadin. Aman dijalankan berulang.
--   dasar_penugasan : dasar Surat Tugas, satu baris = satu butir (kosong = dasar DPA otomatis)
--   hasil_kegiatan  : uraian hasil kegiatan pada Laporan (kosong = kalimat umum otomatis)
-- =========================================================
alter table public.perjadin add column if not exists dasar_penugasan text;
alter table public.perjadin add column if not exists hasil_kegiatan text;
