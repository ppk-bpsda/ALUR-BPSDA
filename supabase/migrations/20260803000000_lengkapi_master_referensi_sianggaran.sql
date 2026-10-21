-- =========================================================
-- LENGKAPI DATA MASTER REFERENSI (sumber: master_sianggaran.zip)
-- Program, Kegiatan, Sub Kegiatan, Kode Rekening Belanja, Sumber Dana, PPTK
-- =========================================================
-- ATURAN YANG DIPAKAI (sesuai permintaan: data sama digabung, data baru
-- ditambahkan, data yang sudah ada TIDAK diganggu):
--
--  1) Program / Kegiatan / Sub Kegiatan  -> ditambahkan ke tabel ALUR
--     yang sudah ada (program, kegiatan, sub_kegiatan) untuk Tahun
--     Anggaran v_tahun di bawah. Kalau kodenya sudah ada: DIBIARKAN
--     (nama lama tidak ditimpa). Kalau belum ada: ditambahkan.
--
--  2) Kode Rekening Belanja (157 kode)   -> disimpan sebagai KATALOG
--     REFERENSI di tabel baru `ref_belanja`. TIDAK dimasukkan ke
--     `rekening_belanja`, karena di ALUR sebuah rekening selalu melekat
--     pada satu sub kegiatan + sumber dana + pagu, sedangkan master ini
--     tidak punya relasi itu -- memasukkannya akan membuat ratusan
--     rekening/pagu fiktif. Katalog dipakai sebagai pilihan otomatis di
--     menu Rekening & Pagu. Kode yang sudah dipakai di rekening_belanja
--     tetapi belum ada di master ikut dimasukkan ke katalog.
--
--  3) Sumber Dana                        -> katalog `ref_sumber_dana`
--     (PAD, DBH CHT + nilai yang sudah terpakai di rekening_belanja).
--
--  4) PPTK                               -> ditambahkan ke `pejabat_skpd`
--     (jabatan PPTK) HANYA bila belum ada PPTK dengan nama yang sama
--     (huruf besar/kecil & gelar diabaikan saat mencocokkan). Baris
--     PPTK lama tidak diubah. NIP baru dikosongkan ('') -- file master
--     tidak memuat NIP; lengkapi lewat menu Pejabat.
--
--  5) Perbaikan nama yang jelas keliru (dijaga ketat):
--     a. sub kegiatan 4.01.03.2.01.0004 & 0005 di DB bernama sama persis
--        dengan 0003 (salah salin saat impor awal). Diganti nama resmi
--        dari master HANYA bila namanya kembar dengan saudara sekegiatan
--        DAN belum punya rekening sama sekali.
--     b. master memberi nama 4.01.01.2.09.0001 sama dengan 2.09.0002
--        (Operasional/Lapangan). Itu salah salin; kodifikasi resmi:
--        0001 = Kendaraan Perorangan Dinas atau Kendaraan Dinas Jabatan.
--        Yang dimasukkan adalah nama yang sudah dikoreksi.
--
--  6) Perbedaan nama antara master vs data yang sudah ada DILAPORKAN
--     lewat RAISE NOTICE (tidak diubah) supaya Admin bisa meninjau.
--
-- AMAN dijalankan berulang (idempotent) dan atomik (satu transaksi).
-- PRASYARAT: migrasi 20260801000000_hardening_rls_admin_only.sql
-- (fungsi public.is_admin()) sudah dijalankan.
-- =========================================================

begin;

do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'Fungsi public.is_admin() belum ada. Jalankan dulu migrasi 20260801000000_hardening_rls_admin_only.sql.';
  end if;
end $$;

-- ---------------------------------------------------------
-- 1) TABEL KATALOG BARU
-- ---------------------------------------------------------
create table if not exists public.ref_belanja (
  kode_belanja text primary key
    check (kode_belanja ~ '^[0-9]\.[0-9]\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}\.[0-9]{5}$'),
  nama_belanja text not null check (length(btrim(nama_belanja)) > 0),
  created_at   timestamptz not null default now()
);
comment on table public.ref_belanja is
  'Katalog kode rekening belanja (6 segmen) -- referensi pilihan di menu Rekening & Pagu. Bukan data pagu.';

create table if not exists public.ref_sumber_dana (
  id         bigint generated always as identity primary key,
  nama       text not null check (length(btrim(nama)) > 0),
  created_at timestamptz not null default now()
);
create unique index if not exists ref_sumber_dana_nama_uniq
  on public.ref_sumber_dana (lower(btrim(nama)));
comment on table public.ref_sumber_dana is
  'Katalog sumber dana -- referensi pilihan di menu Rekening & Pagu.';

-- ---------------------------------------------------------
-- 2) KEAMANAN: RLS hanya Admin (baca saja dari aplikasi; tulis
--    hanya lewat migrasi/service_role). anon tidak punya akses.
-- ---------------------------------------------------------
alter table public.ref_belanja     enable row level security;
alter table public.ref_sumber_dana enable row level security;

drop policy if exists "admin read" on public.ref_belanja;
drop policy if exists "admin read" on public.ref_sumber_dana;
create policy "admin read" on public.ref_belanja
  for select to authenticated using (public.is_admin());
create policy "admin read" on public.ref_sumber_dana
  for select to authenticated using (public.is_admin());

revoke all on public.ref_belanja     from anon, authenticated;
revoke all on public.ref_sumber_dana from anon, authenticated;
grant select on public.ref_belanja     to authenticated;
grant select on public.ref_sumber_dana to authenticated;

-- ---------------------------------------------------------
-- 3) DATA MASTER (staging, dibuang otomatis di akhir transaksi)
-- ---------------------------------------------------------
create temp table _m_program  (kode text primary key, nama text not null) on commit drop;
create temp table _m_kegiatan (kode text primary key, kode_program text not null, nama text not null) on commit drop;
create temp table _m_sub      (kode text primary key, kode_kegiatan text not null, nama text not null) on commit drop;
create temp table _m_belanja  (kode text primary key, nama text not null) on commit drop;
create temp table _m_pptk     (nama text not null) on commit drop;
create temp table _m_sd       (nama text not null) on commit drop;

insert into _m_program (kode, nama) values
  ('4.01.01', 'PROGRAM PENUNJANG URUSAN PEMERINTAHAN DAERAH KABUPATEN/KOTA'),
  ('4.01.03', 'PROGRAM PEREKONOMIAN DAN PEMBANGUNAN');

insert into _m_kegiatan (kode, kode_program, nama) values
  ('4.01.01.2.02', '4.01.01', 'Administrasi Keuangan Perangkat Daerah'),
  ('4.01.01.2.03', '4.01.01', 'Administrasi Barang Milik Daerah pada Perangkat Daerah'),
  ('4.01.01.2.05', '4.01.01', 'Administrasi Kepegawaian Perangkat Daerah'),
  ('4.01.01.2.06', '4.01.01', 'Administrasi Umum Perangkat Daerah'),
  ('4.01.01.2.07', '4.01.01', 'Pengadaan Barang Milik Daerah Penunjang Urusan Pemerintah Daerah'),
  ('4.01.01.2.08', '4.01.01', 'Penyediaan Jasa Penunjang Urusan Pemerintahan Daerah'),
  ('4.01.01.2.09', '4.01.01', 'Pemeliharaan Barang Milik Daerah Penunjang Urusan Pemerintahan Daerah'),
  ('4.01.03.2.01', '4.01.03', 'Pelaksanaan Kebijakan Perekonomian'),
  ('4.01.03.2.04', '4.01.03', 'Pemantauan Kebijakan Sumber Daya Alam');

insert into _m_sub (kode, kode_kegiatan, nama) values
  ('4.01.01.2.02.0002', '4.01.01.2.02', 'Penyediaan Administrasi Pelaksanaan Tugas ASN'),
  ('4.01.01.2.02.0003', '4.01.01.2.02', 'Pelaksanaan Penatausahaan dan Pengujian/Verifikasi Keuangan SKPD'),
  ('4.01.01.2.03.0006', '4.01.01.2.03', 'Penatausahaan Barang Milik Daerah pada SKPD'),
  ('4.01.01.2.05.0002', '4.01.01.2.05', 'Pengadaan Pakaian Dinas beserta Atribut Kelengkapannya'),
  ('4.01.01.2.05.0009', '4.01.01.2.05', 'Pendidikan dan Pelatihan Pegawai Berdasarkan Tugas dan Fungsi'),
  ('4.01.01.2.06.0002', '4.01.01.2.06', 'Penyediaan Peralatan dan Perlengkapan Kantor'),
  ('4.01.01.2.06.0003', '4.01.01.2.06', 'Penyediaan Peralatan Rumah Tangga'),
  ('4.01.01.2.06.0004', '4.01.01.2.06', 'Penyediaan Bahan Logistik Kantor'),
  ('4.01.01.2.06.0005', '4.01.01.2.06', 'Penyediaan Barang Cetakan dan Penggandaan'),
  ('4.01.01.2.06.0007', '4.01.01.2.06', 'Penyediaan Bahan/Material'),
  ('4.01.01.2.06.0008', '4.01.01.2.06', 'Fasilitasi Kunjungan Tamu'),
  ('4.01.01.2.06.0009', '4.01.01.2.06', 'Penyelenggaraan Rapat Koordinasi dan Konsultasi SKPD'),
  ('4.01.01.2.06.0010', '4.01.01.2.06', 'Penatausahaan Arsip Dinamis pada SKPD'),
  ('4.01.01.2.07.0001', '4.01.01.2.07', 'Pengadaan Kendaraan Perorangan Dinas atau Kendaraan Dinas Jabatan'),
  ('4.01.01.2.07.0002', '4.01.01.2.07', 'Pengadaan Kendaraan Dinas Operasional atau Lapangan'),
  ('4.01.01.2.07.0005', '4.01.01.2.07', 'Pengadaan Mebel'),
  ('4.01.01.2.07.0006', '4.01.01.2.07', 'Pengadaan Peralatan dan Mesin Lainnya'),
  ('4.01.01.2.07.0010', '4.01.01.2.07', 'Pengadaan Sarana dan Prasarana Gedung Kantor atau Bangunan Lainnya'),
  ('4.01.01.2.07.0011', '4.01.01.2.07', 'Pengadaan Sarana dan Prasarana Pendukung Gedung Kantor atau Bangunan Lainnya'),
  ('4.01.01.2.08.0001', '4.01.01.2.08', 'Penyediaan Jasa Surat Menyurat'),
  ('4.01.01.2.08.0002', '4.01.01.2.08', 'Penyediaan Jasa Komunikasi, Sumber Daya Air dan Listrik'),
  ('4.01.01.2.08.0004', '4.01.01.2.08', 'Penyediaan Jasa Pelayanan Umum Kantor'),
  ('4.01.01.2.09.0001', '4.01.01.2.09', 'Penyediaan Jasa Pemeliharaan, Biaya Pemeliharaan, Pajak dan Perizinan Kendaraan Perorangan Dinas atau Kendaraan Dinas Jabatan'),
  ('4.01.01.2.09.0002', '4.01.01.2.09', 'Penyediaan Jasa Pemeliharaan, Biaya Pemeliharaan, Pajak dan Perizinan Kendaraan Dinas Operasional atau Lapangan'),
  ('4.01.01.2.09.0006', '4.01.01.2.09', 'Pemeliharaan Peralatan dan Mesin Lainnya'),
  ('4.01.01.2.09.0009', '4.01.01.2.09', 'Pemeliharaan/Rehabilitasi Gedung Kantor dan Bangunan Lainnya'),
  ('4.01.03.2.01.0001', '4.01.03.2.01', 'Koordinasi, Sinkronisasi, Monitoring dan Evaluasi Kebijakan Pengelolaan BUMD dan BLUD'),
  ('4.01.03.2.01.0002', '4.01.03.2.01', 'Pengendalian dan Distribusi Perekonomian'),
  ('4.01.03.2.01.0003', '4.01.03.2.01', 'Perencanaan dan Pengawasan Ekonomi Mikro Kecil'),
  ('4.01.03.2.01.0004', '4.01.03.2.01', 'Koordinasi, Sinkronisasi dan Evaluasi Kebijakan Pembentukan BLUD'),
  ('4.01.03.2.01.0005', '4.01.03.2.01', 'Koordinasi, Sinkronisasi dan Evaluasi Kebijakan Pendirian BUMD'),
  ('4.01.03.2.01.0006', '4.01.03.2.01', 'Koordinasi, Sinkronisasi dan Evaluasi Pelaksanaan Tugas Tim Percepatan Akses Keuangan Daerah (TPAKD)'),
  ('4.01.03.2.04.0001', '4.01.03.2.04', 'Koordinasi, Sinkronisasi dan Evaluasi Kebijakan Pertanian, Kehutanan, Kelautan, dan Perikanan'),
  ('4.01.03.2.04.0002', '4.01.03.2.04', 'Koordinasi, Sinkronisasi dan Evaluasi Kebijakan Pertambangan dan Lingkungan Hidup'),
  ('4.01.03.2.04.0003', '4.01.03.2.04', 'Koordinasi, Sinkronisasi dan Evaluasi Kebijakan Energi dan Air');

insert into _m_belanja (kode, nama) values
  ('5.1.02.01.001.00012', 'Belanja Bahan-Bahan Lainnya'),
  ('5.1.02.01.001.00018', 'Belanja Suku Cadang-Suku Cadang Alat Studio dan Komunikasi'),
  ('5.1.02.01.001.00024', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor'),
  ('5.1.02.01.001.00025', 'Belanja Alat/Bahan untuk Kegiatan Kantor- Kertas dan Cover'),
  ('5.1.02.01.001.00026', 'Belanja Alat/Bahan untuk Kegiatan Kantor- Bahan Cetak'),
  ('5.1.02.01.001.00027', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Benda Pos'),
  ('5.1.02.01.001.00029', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Bahan Komputer'),
  ('5.1.02.01.001.00030', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Perabot Kantor'),
  ('5.1.02.01.001.00031', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Listrik'),
  ('5.1.02.01.001.00032', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Perlengkapan Dinas'),
  ('5.1.02.01.001.00035', 'Belanja Alat/Bahan untuk Kegiatan Kantor- Suvenir/Cendera Mata'),
  ('5.1.02.01.001.00036', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Alat/Bahan untuk Kegiatan Kantor Lainnya'),
  ('5.1.02.01.001.00037', 'Belanja Obat-Obatan-Obat'),
  ('5.1.02.01.001.00038', 'Belanja Obat-Obatan-Obat-Obatan Lainnya'),
  ('5.1.02.01.001.00043', 'Belanja Natura dan Pakan-Natura'),
  ('5.1.02.01.001.00044', 'Belanja Natura dan Pakan-Pakan'),
  ('5.1.02.01.001.00045', 'Belanja Natura dan Pakan-Natura dan Pakan Lainnya'),
  ('5.1.02.01.001.00052', 'Belanja Makanan dan Minuman Rapat'),
  ('5.1.02.01.001.00053', 'Belanja Makanan dan Minuman Jamuan Tamu'),
  ('5.1.02.01.001.00054', 'Belanja Penambah Daya Tahan Tubuh'),
  ('5.1.02.01.001.00058', 'Belanja Makanan dan Minuman Aktivitas Lapangan'),
  ('5.1.02.01.001.00063', 'Belanja Pakaian Dinas Harian (PDH)'),
  ('5.1.02.01.001.00073', 'Belanja Pakaian KORPRI'),
  ('5.1.02.01.001.00074', 'Belanja Pakaian Adat Daerah'),
  ('5.1.02.01.001.00075', 'Belanja Pakaian Batik Tradisional'),
  ('5.1.02.01.001.00076', 'Belanja Pakaian Olahraga'),
  ('5.1.02.01.004.00035', 'Belanja Peralatan dan Mesin-Alat Angkutan-Alat Angkutan Darat Bermotor-Kendaraan Dinas Bermotor Perorangan'),
  ('5.1.02.01.004.00036', 'Belanja Peralatan dan Mesin-Alat Angkutan-Alat Angkutan Darat Bermotor-Kendaraan Bermotor Penumpang'),
  ('5.1.02.01.004.00038', 'Belanja Peralatan dan Mesin-Alat Angkutan-Alat Angkutan Darat Bermotor-Kendaraan Bermotor Beroda Dua'),
  ('5.1.02.01.004.00118', 'Belanja Peralatan dan Mesin-Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Mebel'),
  ('5.1.02.01.004.00119', 'Belanja Peralatan dan Mesin-Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Alat Pengukur Waktu'),
  ('5.1.02.01.004.00120', 'Belanja Peralatan dan Mesin-Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Alat Pembersih'),
  ('5.1.02.01.004.00121', 'Belanja Peralatan dan Mesin-Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Alat Pendingin'),
  ('5.1.02.01.004.00122', 'Belanja Peralatan dan Mesin-Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Alat Dapur'),
  ('5.1.02.01.004.00123', 'Belanja Peralatan dan Mesin-Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Alat Rumah Tangga Lainnya (Home Use)'),
  ('5.1.02.01.004.00124', 'Belanja Peralatan dan Mesin-Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Alat Pemadam Kebakaran'),
  ('5.1.02.01.004.00125', 'Belanja Peralatan dan Mesin-Alat Kantor dan Rumah Tangga-Meja dan Kursi Kerja/Rapat Pejabat-Meja Kerja Pejabat'),
  ('5.1.02.01.004.00126', 'Belanja Peralatan dan Mesin-Alat Kantor dan Rumah Tangga-Meja dan Kursi Kerja/Rapat Pejabat-Meja Rapat Pejabat'),
  ('5.1.02.01.004.00127', 'Belanja Peralatan dan Mesin-Alat Kantor dan Rumah Tangga-Meja dan Kursi Kerja/Rapat Pejabat-Kursi Kerja Pejabat'),
  ('5.1.02.01.004.00128', 'Belanja Peralatan dan Mesin-Alat Kantor dan Rumah Tangga-Meja dan Kursi Kerja/Rapat Pejabat-Kursi Rapat Pejabat'),
  ('5.1.02.01.004.00129', 'Belanja Peralatan dan Mesin-Alat Kantor dan Rumah Tangga-Meja dan Kursi Kerja/Rapat Pejabat-Kursi Hadap Depan Meja Kerja Pejabat'),
  ('5.1.02.01.004.00130', 'Belanja Peralatan dan Mesin-Alat Kantor dan Rumah Tangga-Meja dan Kursi Kerja/Rapat Pejabat-Kursi Tamu di Ruangan Pejabat'),
  ('5.1.02.01.004.00131', 'Belanja Peralatan dan Mesin-Alat Kantor dan Rumah Tangga-Meja dan Kursi Kerja/Rapat Pejabat-Lemari dan Arsip Pejabat'),
  ('5.1.02.01.004.00132', 'Belanja Peralatan dan Mesin-Alat Studio, Komunikasi, dan Pemancar-Alat Studio-Peralatan Studio Audio'),
  ('5.1.02.01.004.00133', 'Belanja Peralatan dan Mesin-Alat Studio, Komunikasi, dan Pemancar-Alat Studio-Peralatan Studio Video dan Film'),
  ('5.1.02.01.004.00137', 'Belanja Peralatan dan Mesin-Alat Studio, Komunikasi, dan Pemancar-Alat Studio-Alat Studio Lainnya'),
  ('5.1.02.01.004.00405', 'Belanja Peralatan dan Mesin-Komputer-Komputer Unit-Personal Computer'),
  ('5.1.02.01.004.00409', 'Belanja Peralatan dan Mesin-Komputer-Peralatan Komputer-Peralatan Personal Computer'),
  ('5.1.02.01.004.00410', 'Belanja Peralatan dan Mesin-Komputer-Peralatan Komputer-Peralatan Jaringan'),
  ('5.1.02.01.004.00411', 'Belanja Peralatan dan Mesin-Komputer-Peralatan Komputer-Peralatan Komputer Lainnya'),
  ('5.1.02.02.001.00001', 'Belanja Jasa Pengelolaan BMD yang Tidak Menghasilkan Pendapatan'),
  ('5.1.02.02.001.00003', 'Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia'),
  ('5.1.02.02.001.00004', 'Honorarium Tim Pelaksana Kegiatan dan Sekretariat Tim Pelaksana Kegiatan'),
  ('5.1.02.02.001.00005', 'Honorarium Pemberi Keterangan Ahli, Saksi Ahli, dan Beracara'),
  ('5.1.02.02.001.00006', 'Honorarium Penyuluhan atau Pendampingan'),
  ('5.1.02.02.001.00016', 'Belanja Jasa Tenaga Penanganan Prasarana dan Sarana Umum'),
  ('5.1.02.02.001.00028', 'Belanja Jasa Tenaga Pelayanan Umum'),
  ('5.1.02.02.001.00029', 'Belanja Jasa Tenaga Ahli'),
  ('5.1.02.02.001.00030', 'Belanja Jasa Tenaga Kebersihan'),
  ('5.1.02.02.001.00038', 'Belanja Jasa Tata Rias'),
  ('5.1.02.02.001.00047', 'Belanja Jasa Penyelenggaraan Acara'),
  ('5.1.02.02.001.00054', 'Belanja Jasa Jalan/Tol'),
  ('5.1.02.02.001.00064', 'Belanja Paket/Pengiriman'),
  ('5.1.02.02.001.00067', 'Belanja Pembayaran Pajak, Bea, dan Perizinan'),
  ('5.1.02.02.001.00080', 'Belanja Honorarium Penanggungjawaban Pengelola Keuangan'),
  ('5.1.02.02.001.00081', 'Belanja Honorarium Pengadaan Barang/Jasa'),
  ('5.1.02.02.004.00035', 'Belanja Sewa Kendaraan Dinas Bermotor Perorangan'),
  ('5.1.02.02.004.00036', 'Belanja Sewa Kendaraan Bermotor Penumpang'),
  ('5.1.02.02.004.00038', 'Belanja Sewa Kendaraan Bermotor Beroda Dua'),
  ('5.1.02.02.004.00116', 'Belanja Sewa Alat Penyimpan Perlengkapan Kantor'),
  ('5.1.02.02.004.00117', 'Belanja Sewa Alat Kantor Lainnya'),
  ('5.1.02.02.004.00118', 'Belanja Sewa Mebel'),
  ('5.1.02.02.004.00119', 'Belanja Sewa Alat Pengukur Waktu'),
  ('5.1.02.02.004.00120', 'Belanja Sewa Alat Pembersih'),
  ('5.1.02.02.004.00121', 'Belanja Sewa Alat Pendingin'),
  ('5.1.02.02.004.00122', 'Belanja Sewa Alat Dapur'),
  ('5.1.02.02.004.00123', 'Belanja Sewa Alat Rumah Tangga Lainnya (Home Use)'),
  ('5.1.02.02.004.00124', 'Belanja Sewa Alat Pemadam Kebakaran'),
  ('5.1.02.02.004.00125', 'Belanja Sewa Meja Kerja Pejabat'),
  ('5.1.02.02.004.00126', 'Belanja Sewa Meja Rapat Pejabat'),
  ('5.1.02.02.004.00127', 'Belanja Sewa Kursi Kerja Pejabat'),
  ('5.1.02.02.004.00128', 'Belanja Sewa Kursi Rapat Pejabat'),
  ('5.1.02.02.004.00129', 'Belanja Sewa Kursi Hadap Depan Meja Kerja Pejabat'),
  ('5.1.02.02.004.00130', 'Belanja Sewa Kursi Tamu di Ruangan Pejabat'),
  ('5.1.02.02.004.00131', 'Belanja Sewa Lemari dan Arsip Pejabat'),
  ('5.1.02.02.004.00132', 'Belanja Sewa Peralatan Studio Audio'),
  ('5.1.02.02.004.00133', 'Belanja Sewa Peralatan Studio Video dan Film'),
  ('5.1.02.02.004.00137', 'Belanja Sewa Alat Studio Lainnya'),
  ('5.1.02.02.004.00405', 'Belanja Sewa Personal Computer'),
  ('5.1.02.02.004.00409', 'Belanja Sewa Peralatan Personal Computer'),
  ('5.1.02.02.004.00410', 'Belanja Sewa Peralatan Jaringan'),
  ('5.1.02.02.004.00411', 'Belanja Sewa Peralatan Komputer Lainnya'),
  ('5.1.02.02.005.00009', 'Belanja Sewa Bangunan Gedung Tempat Pertemuan'),
  ('5.1.02.02.005.00043', 'Belanja Sewa Hotel'),
  ('5.1.02.02.009.00011', 'Belanja Jasa Konsultansi Berorientasi Layanan-Jasa Survei'),
  ('5.1.02.02.009.00012', 'Belanja Jasa Konsultansi Berorientasi Layanan-Jasa Studi Penelitian dan Bantuan Teknik'),
  ('5.1.02.02.009.00013', 'Belanja Jasa Konsultansi Berorientasi Layanan-Jasa Konsultansi Manajemen'),
  ('5.1.02.02.009.00014', 'Belanja Jasa Konsultansi Berorientasi Layanan-Jasa Khusus'),
  ('5.1.02.02.012.00001', 'Belanja Kursus Singkat/Pelatihan'),
  ('5.1.02.02.015.00005', 'Belanja Sewa Aset Tidak Berwujud-Software'),
  ('5.1.02.03.002.00035', 'Belanja Pemeliharaan Alat Angkutan-Alat Angkutan Darat Bermotor-Kendaraan Dinas Bermotor Perorangan'),
  ('5.1.02.03.002.00036', 'Belanja Pemeliharaan Alat Angkutan-Alat Angkutan Darat Bermotor-Kendaraan Bermotor Penumpang'),
  ('5.1.02.03.002.00038', 'Belanja Pemeliharaan Alat Angkutan-Alat Angkutan Darat Bermotor-Kendaraan Bermotor Beroda Dua'),
  ('5.1.02.03.002.00116', 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Kantor-Alat Penyimpan Perlengkapan Kantor'),
  ('5.1.02.03.002.00117', 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Kantor-Alat Kantor Lainnya'),
  ('5.1.02.03.002.00118', 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Mebel'),
  ('5.1.02.03.002.00119', 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Alat Pengukur Waktu'),
  ('5.1.02.03.002.00121', 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Alat Pendingin'),
  ('5.1.02.03.002.00122', 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Alat Dapur'),
  ('5.1.02.03.002.00123', 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Alat Rumah Tangga Lainnya (Home Use)'),
  ('5.1.02.03.002.00124', 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Alat Pemadam Kebakaran'),
  ('5.1.02.03.002.00125', 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Meja dan Kursi Kerja/Rapat Pejabat-Meja Kerja Pejabat'),
  ('5.1.02.03.002.00126', 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Meja dan Kursi Kerja/Rapat Pejabat-Meja Rapat Pejabat'),
  ('5.1.02.03.002.00127', 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Meja dan Kursi Kerja/Rapat Pejabat-Kursi Kerja Pejabat'),
  ('5.1.02.03.002.00128', 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Meja dan Kursi Kerja/Rapat Pejabat-Kursi Rapat Pejabat'),
  ('5.1.02.03.002.00129', 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Meja dan Kursi Kerja/Rapat Pejabat-Kursi Hadap Depan Meja Kerja Pejabat'),
  ('5.1.02.03.002.00130', 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Meja dan Kursi Kerja/Rapat Pejabat-Kursi Tamu di Ruangan Pejabat'),
  ('5.1.02.03.002.00131', 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Meja dan Kursi Kerja/Rapat Pejabat-Lemari dan Arsip Pejabat'),
  ('5.1.02.03.002.00132', 'Belanja Pemeliharaan Alat Studio, Komunikasi, dan Pemancar-Alat Studio-Peralatan Studio Audio'),
  ('5.1.02.03.002.00133', 'Belanja Pemeliharaan Alat Studio, Komunikasi, dan Pemancar-Alat Studio-Peralatan Studio Video dan Film'),
  ('5.1.02.03.002.00134', 'Belanja Pemeliharaan Alat Studio, Komunikasi, dan Pemancar-Alat Studio-Peralatan Studio Gambar'),
  ('5.1.02.03.002.00137', 'Belanja Pemeliharaan Alat Studio, Komunikasi, dan Pemancar-Alat Studio-Alat Studio Lainnya'),
  ('5.1.02.03.002.00405', 'Belanja Pemeliharaan Komputer-Komputer Unit-Personal Computer'),
  ('5.1.02.03.002.00409', 'Belanja Pemeliharaan Komputer-Peralatan Komputer-Peralatan Personal Computer'),
  ('5.1.02.03.002.00410', 'Belanja Pemeliharaan Komputer-Peralatan Komputer-Peralatan Jaringan'),
  ('5.1.02.03.002.00411', 'Belanja Pemeliharaan Komputer-Peralatan Komputer-Peralatan Komputer Lainnya'),
  ('5.1.02.03.003.00001', 'Belanja Pemeliharaan Bangunan Gedung-Bangunan Gedung Tempat Kerja-Bangunan Gedung Kantor'),
  ('5.1.02.04.001.00001', 'Belanja Perjalanan Dinas Biasa'),
  ('5.1.02.04.001.00003', 'Belanja Perjalanan Dinas Dalam Kota'),
  ('5.1.02.04.001.00004', 'Belanja Perjalanan Dinas Paket Meeting Dalam Kota'),
  ('5.1.02.04.001.00005', 'Belanja Perjalanan Dinas Paket Meeting Luar Kota'),
  ('5.2.02.02.001.00001', 'Belanja Modal Kendaraan Dinas Bermotor Perorangan'),
  ('5.2.02.02.001.00002', 'Belanja Modal Kendaraan Bermotor Penumpang'),
  ('5.2.02.02.001.00004', 'Belanja Modal Kendaraan Bermotor Beroda Dua'),
  ('5.2.02.05.001.00004', 'Belanja Modal Alat Penyimpan Perlengkapan Kantor'),
  ('5.2.02.05.001.00005', 'Belanja Modal Alat Kantor Lainnya'),
  ('5.2.02.05.002.00001', 'Belanja Modal Mebel'),
  ('5.2.02.05.002.00003', 'Belanja Modal Alat Pembersih'),
  ('5.2.02.05.002.00004', 'Belanja Modal Alat Pendingin'),
  ('5.2.02.05.002.00005', 'Belanja Modal Alat Dapur'),
  ('5.2.02.05.002.00006', 'Belanja Modal Alat Rumah Tangga Lainnya (Home Use)'),
  ('5.2.02.05.002.00007', 'Belanja Modal Alat Pemadam Kebakaran'),
  ('5.2.02.05.003.00001', 'Belanja Modal Meja Kerja Pejabat'),
  ('5.2.02.05.003.00002', 'Belanja Modal Meja Rapat Pejabat'),
  ('5.2.02.05.003.00003', 'Belanja Modal Kursi Kerja Pejabat'),
  ('5.2.02.05.003.00004', 'Belanja Modal Kursi Rapat Pejabat'),
  ('5.2.02.05.003.00005', 'Belanja Modal Kursi Hadap Depan Meja Kerja Pejabat'),
  ('5.2.02.05.003.00006', 'Belanja Modal Kursi Tamu di Ruangan Pejabat'),
  ('5.2.02.05.003.00007', 'Belanja Modal Lemari dan Arsip Pejabat'),
  ('5.2.02.06.001.00001', 'Belanja Modal Peralatan Studio Audio'),
  ('5.2.02.06.001.00002', 'Belanja Modal Peralatan Studio Video dan Film'),
  ('5.2.02.06.001.00006', 'Belanja Modal Alat Studio Lainnya'),
  ('5.2.02.10.001.00002', 'Belanja Modal Personal Computer'),
  ('5.2.02.10.001.00003', 'Belanja Modal Komputer Unit Lainnya'),
  ('5.2.02.10.002.00003', 'Belanja Modal Peralatan Personal Computer'),
  ('5.2.02.10.002.00004', 'Belanja Modal Peralatan Jaringan'),
  ('5.2.02.10.002.00005', 'Belanja Modal Peralatan Komputer Lainnya');

insert into _m_pptk (nama) values
  ('TENGKO WOLOK, S.T.'),
  ('DIYAH WAHYUNI, S.E., M.M.'),
  ('SARI ANAS PUTRI, S.E.');

insert into _m_sd (nama) values
  ('PAD'),
  ('DBH CHT');

-- ---------------------------------------------------------
-- 4) PROGRAM -> KEGIATAN -> SUB KEGIATAN (tambah yang baru saja)
-- ---------------------------------------------------------
do $$
declare
  v_tahun int := 2026;          -- Tahun Anggaran target (seluruh data ALUR saat ini TA 2026)
  v_n int;
  r record;
begin
  insert into program (kode_program, nama_program, tahun_anggaran)
  select m.kode, m.nama, v_tahun from _m_program m
  on conflict (kode_program, tahun_anggaran) do nothing;
  get diagnostics v_n = row_count;
  raise notice 'Program     : % baru ditambahkan (dari 2 di master).', v_n;

  insert into kegiatan (program_id, kode_kegiatan, nama_kegiatan, tahun_anggaran)
  select p.id, m.kode, m.nama, v_tahun
  from _m_kegiatan m
  join program p on p.kode_program = m.kode_program and p.tahun_anggaran = v_tahun
  on conflict (kode_kegiatan, tahun_anggaran) do nothing;
  get diagnostics v_n = row_count;
  raise notice 'Kegiatan    : % baru ditambahkan (dari 9 di master).', v_n;

  insert into sub_kegiatan (kegiatan_id, kode_sub_kegiatan, nama_sub_kegiatan, tahun_anggaran)
  select k.id, m.kode, m.nama, v_tahun
  from _m_sub m
  join kegiatan k on k.kode_kegiatan = m.kode_kegiatan and k.tahun_anggaran = v_tahun
  on conflict (kode_sub_kegiatan, tahun_anggaran) do nothing;
  get diagnostics v_n = row_count;
  raise notice 'Sub Kegiatan: % baru ditambahkan (dari 35 di master).', v_n;

  -- 5a) Nama kembar yang jelas keliru (lihat catatan di kepala file) -----
  update sub_kegiatan s
  set nama_sub_kegiatan = m.nama
  from _m_sub m
  where s.kode_sub_kegiatan = m.kode
    and s.tahun_anggaran = v_tahun
    and lower(btrim(s.nama_sub_kegiatan)) <> lower(btrim(m.nama))
    and exists (
      select 1 from sub_kegiatan s2
      where s2.kegiatan_id = s.kegiatan_id and s2.id <> s.id and s2.tahun_anggaran = v_tahun
        and lower(btrim(s2.nama_sub_kegiatan)) = lower(btrim(s.nama_sub_kegiatan))
    )
    and not exists (select 1 from rekening_belanja rb where rb.sub_kegiatan_id = s.id);
  get diagnostics v_n = row_count;
  raise notice 'Sub Kegiatan: % nama kembar yang keliru dikoreksi.', v_n;

  -- 6) LAPORAN: nama berbeda (TIDAK diubah) -----------------------------
  for r in
    select k.kode_kegiatan as kode, k.nama_kegiatan as nama_db, m.nama as nama_master, 'kegiatan' as jenis
    from kegiatan k join _m_kegiatan m on m.kode = k.kode_kegiatan
    where k.tahun_anggaran = v_tahun
      and lower(regexp_replace(regexp_replace(k.nama_kegiatan, '[,.]', '', 'g'), '\s+', ' ', 'g'))
       <> lower(regexp_replace(regexp_replace(m.nama,          '[,.]', '', 'g'), '\s+', ' ', 'g'))
    union all
    select s.kode_sub_kegiatan, s.nama_sub_kegiatan, m.nama, 'sub kegiatan'
    from sub_kegiatan s join _m_sub m on m.kode = s.kode_sub_kegiatan
    where s.tahun_anggaran = v_tahun
      and lower(regexp_replace(regexp_replace(s.nama_sub_kegiatan, '[,.]', '', 'g'), '\s+', ' ', 'g'))
       <> lower(regexp_replace(regexp_replace(m.nama,              '[,.]', '', 'g'), '\s+', ' ', 'g'))
    order by 1
  loop
    raise notice 'BEDA NAMA % % | di DB (dipertahankan): % | di master: %', r.jenis, r.kode, r.nama_db, r.nama_master;
  end loop;
end $$;

-- ---------------------------------------------------------
-- 5) KATALOG KODE REKENING BELANJA
--    Urutan & aturan (supaya katalog SELARAS dengan data ALUR):
--    a. Kode yang SUDAH dipakai di rekening_belanja masuk lebih dulu
--       (kode + uraian ALUR dipertahankan; akhiran " (<sumber dana>)"
--       pada uraian dibuang).
--    b. Kode dari master ditambahkan bila kodenya belum ada DAN
--       uraiannya belum ada di katalog. Baris master yang bentrok
--       dengan data ALUR dilewati dan dilaporkan (RAISE NOTICE).
-- ---------------------------------------------------------
do $$
declare
  v_n int;
  r record;
begin
  -- a. dari rekening_belanja yang sudah ada
  insert into ref_belanja (kode_belanja, nama_belanja)
  select x.kode, min(x.nama)
  from (
    select substring(rb.kode_rekening from '([0-9]\.[0-9]\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}\.[0-9]{5})$') as kode,
           btrim(case when lower(right(rb.jenis_belanja, length(rb.sumber_dana) + 3)) = lower(' (' || rb.sumber_dana || ')')
                      then left(rb.jenis_belanja, length(rb.jenis_belanja) - length(rb.sumber_dana) - 3)
                      else rb.jenis_belanja end) as nama
    from rekening_belanja rb
    where coalesce(btrim(rb.jenis_belanja), '') <> ''
  ) x
  where x.kode is not null
  group by x.kode
  on conflict (kode_belanja) do nothing;
  get diagnostics v_n = row_count;
  raise notice 'Katalog belanja: % kode dari rekening yang sudah ada.', v_n;

  -- b. dari master (kode baru DAN uraian baru)
  insert into ref_belanja (kode_belanja, nama_belanja)
  select m.kode, m.nama
  from _m_belanja m
  where not exists (select 1 from ref_belanja b where b.kode_belanja = m.kode)
    and not exists (
      select 1 from ref_belanja b
      where lower(regexp_replace(btrim(b.nama_belanja), '\s+', ' ', 'g'))
          = lower(regexp_replace(btrim(m.nama),         '\s+', ' ', 'g'))
    );
  get diagnostics v_n = row_count;
  raise notice 'Katalog belanja: % kode dari master ditambahkan (dari 157).', v_n;

  -- LAPORAN: baris master yang dilewati karena bentrok dengan data ALUR
  for r in
    select m.kode, m.nama as nama_master, b.nama_belanja as nama_katalog
    from _m_belanja m
    join ref_belanja b on b.kode_belanja = m.kode
    where lower(regexp_replace(btrim(b.nama_belanja), '\s+', ' ', 'g'))
       <> lower(regexp_replace(btrim(m.nama),         '\s+', ' ', 'g'))
    order by m.kode
  loop
    raise notice 'MASTER DILEWATI (kode sama, uraian beda) %: master="%" | ALUR dipakai="%"', r.kode, r.nama_master, r.nama_katalog;
  end loop;
  for r in
    select m.kode, m.nama as nama_master, b.kode_belanja as kode_katalog
    from _m_belanja m
    join ref_belanja b
      on lower(regexp_replace(btrim(b.nama_belanja), '\s+', ' ', 'g'))
       = lower(regexp_replace(btrim(m.nama),         '\s+', ' ', 'g'))
     and b.kode_belanja <> m.kode
    where not exists (select 1 from ref_belanja b2 where b2.kode_belanja = m.kode)
    order by m.kode
  loop
    raise notice 'MASTER DILEWATI (uraian sama, kode beda) "%": master=% | ALUR dipakai=%', r.nama_master, r.kode, r.kode_katalog;
  end loop;
end $$;

-- ---------------------------------------------------------
-- 6) KATALOG SUMBER DANA
-- ---------------------------------------------------------
do $$
declare v_n int;
begin
  insert into ref_sumber_dana (nama)
  select distinct on (lower(btrim(x.nama))) btrim(x.nama)
  from (
    select nama from _m_sd
    union all
    select sumber_dana from rekening_belanja
  ) x
  where coalesce(btrim(x.nama), '') <> ''
  order by lower(btrim(x.nama)), btrim(x.nama)
  on conflict (lower(btrim(nama))) do nothing;
  get diagnostics v_n = row_count;
  raise notice 'Sumber dana : % ditambahkan ke katalog.', v_n;
end $$;

-- ---------------------------------------------------------
-- 7) PPTK -> pejabat_skpd (hanya yang belum ada)
--    Kunci pencocokan: nama tanpa gelar (bagian sebelum koma),
--    tanpa beda huruf besar/kecil, per tahun anggaran.
-- ---------------------------------------------------------
do $$
declare
  v_tahun int := 2026;
  v_n int;
  r record;
begin
  for r in select nama from _m_pptk loop
    if exists (
      select 1 from pejabat_skpd p
      where p.jabatan = 'PPTK'
        and p.tahun_anggaran = v_tahun
        and lower(btrim(regexp_replace(split_part(p.nama, ',', 1), '\s+', ' ', 'g')))
          = lower(btrim(regexp_replace(split_part(r.nama, ',', 1), '\s+', ' ', 'g')))
    ) then
      raise notice 'PPTK sudah ada, dilewati (data lama dipertahankan): %', r.nama;
    else
      insert into pejabat_skpd (jabatan, nama, nip, tahun_anggaran, aktif)
      values ('PPTK', btrim(r.nama), '', v_tahun, true);
      raise notice 'PPTK baru ditambahkan: % (NIP kosong -- lengkapi di menu Pejabat)', r.nama;
    end if;
  end loop;
end $$;

commit;

-- =========================================================
-- VERIFIKASI (jalankan manual setelah migrasi)
-- =========================================================
-- a) Jumlah data:
--    select (select count(*) from program) program, (select count(*) from kegiatan) kegiatan,
--           (select count(*) from sub_kegiatan) sub_kegiatan, (select count(*) from ref_belanja) katalog_belanja,
--           (select count(*) from ref_sumber_dana) sumber_dana,
--           (select count(*) from pejabat_skpd where jabatan='PPTK') pptk;
-- b) Tidak ada kegiatan/sub kegiatan yatim:
--    select * from sub_kegiatan s left join kegiatan k on k.id = s.kegiatan_id where k.id is null;
-- c) RLS aktif & hanya baca:
--    select tablename, policyname, cmd, roles from pg_policies where tablename in ('ref_belanja','ref_sumber_dana');
