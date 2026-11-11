# Pembaruan Pagu Anggaran: Format Tetap, Riwayat Rinci, Simpan Aman

## Pasang (urut)
1. **Backup** database Supabase.
2. SQL Editor: jalankan `supabase/migrations/20260810000000_audit_pagu_dan_simpan_atomik.sql`
   (prasyarat: migrasi 20260801 & 20260804 sudah ada; aman diulang; tidak mengubah data pagu yang ada).
3. Salin file kode ke repo (timpa), deploy. Tidak ada dependency baru.
   Lama: `lib/anggaran/log.ts` dan `public/templates/template-rekening-pagu.csv` dihapus (tidak dipakai lagi).

## Masalah -> perbaikan
| Masalah | Perbaikan |
|---|---|
| Salah kode rekening tidak bisa dilacak | **Riwayat Pagu** (`/rekening/riwayat`): trigger database mencatat SETIAP perubahan pagu, kode, uraian, sumber dana, hapus, salin: siapa, kapan, nilai sebelum -> sesudah, berkas & nomor baris Excel. Cari kode salah maupun kode benar. Log hanya-tambah (tidak bisa diubah dari browser). |
| Edit baris menimpa master semua tahapan tanpa validasi | Kode divalidasi (awalan sub kegiatan + 6 segmen), dicek ke katalog resmi + saran "maksud Anda ...?", hanya ditulis bila berubah; dijaga juga oleh trigger DB. |
| Salah ketik diam-diam jadi rekening baru saat impor | Pratinjau menandai kode di luar katalog, sumber dana beda untuk kode yang sama, sumber dana baru; wajib centang konfirmasi sebelum simpan. |
| Format isian berubah-ubah / template CSV tidak cocok | **Satu format tetap** (unduh dari aplikasi): 1 baris = 1 rekening, kolom `pagu_murni`, `pagu_pergeseran`, `pagu_perubahan`. Tiap tahapan cukup ubah kolomnya; kolom lain dibandingkan & diberi peringatan, tidak diimpor. |
| Koreksi kode lewat Excel jadi rekening ganda | Kolom `id_rekening` (jangan dihapus) membuat perubahan kode dikenali sebagai **koreksi** (kode lama -> baru tercatat). |
| Lambat & bisa setengah jadi | Simpan = satu panggilan SQL `terapkan_pagu()` dalam satu transaksi (gagal = tidak ada yang berubah). Bentrok antar pengguna ditolak. |
| `upsert` diam-diam menimpa nama kegiatan/sub kegiatan/uraian | Diganti insert + penolakan duplikat bernama. |

## Cara kerja tiap tahapan
1. Pilih periode (tahun + tahapan). Rekening & Pagu -> **Unduh format isian**.
2. Ubah hanya kolom pagu tahapan itu (kosong = dilewati; 0 = menolkan).
3. Impor -> Periksa -> baca galat/peringatan -> centang konfirmasi bila diminta -> Simpan.
4. Ada yang salah belakangan? Buka **Riwayat perubahan**, cari kodenya.

## Hasil uji
Migrasi diuji di PostgreSQL 16 (skema minimal tiruan, bukan database live Anda): idempotent, konflik, atomik (baris rusak = rollback termasuk catatan batch), salin, koreksi, log append-only, penolakan kode salah. `tsc` dan `next build` lolos; logika Excel diuji dengan berkas berisi aneka kesalahan.

## Perlu Anda ketahui
- Penjaga kode di DB hanya berlaku untuk baris BARU / yang kodenya diubah; data lama tidak dipaksa.
- Riwayat dimulai dari migrasi ini (perubahan lama tidak bisa direkonstruksi).
- Rekening yang tidak ada di berkas TIDAK dihapus (hanya diinfokan).
- Fungsi SQL berjalan `security definer` (agar bisa menulis log hanya-tambah) dan dijaga `is_admin()`.
- Belum diuji pada Supabase/PostgREST sungguhan: coba dulu di salinan/proyek uji.

---
# Tahap 2: Penelusuran "belanja baru" + audit menyeluruh aplikasi

## Menelusuri belanja baru / salah input
- **Perbandingan Pagu Tahapan**: label hijau "N belanja baru" kini bisa diklik -> **Rincian** (`/rekap-pagu/rincian`): rekening mana yang baru, pagu Murni/Pergeseran/Perubahan berdampingan, siapa-kapan-dari berkas/baris Excel mana (bila tercatat), tautan **Perbaiki** & **Riwayat**. Label merah baru: "tidak dibawa" (ada di tahapan sebelumnya, hilang di berikutnya - sering akibat kode diganti sehingga terbaca "baru" di baris lain).
- **Pemeriksaan Data Pagu** (`/rekening/pemeriksaan`): memeriksa semua rekening: kode salah ketik (+ saran), kode tak berawalan sub kegiatan, uraian beda dari katalog, rekening dobel beda penulisan sumber dana, kelompok belanja janggal, belanja baru/tidak dibawa, pagu nol.
- Rekening & Pagu: tabel kini **berurutan**, ada **pencarian & filter sub kegiatan**, dan halaman (100 baris).
- Data yang dibuat SEBELUM migrasi tidak punya catatan siapa/kapan (kolom "Tidak tercatat"); rekening yang bermasalah tetap terlihat.

## Kesalahan yang ditemukan & diperbaiki
| Temuan | Dampak | Perbaikan |
|---|---|---|
| Query daftar tanpa paginasi (batas 1000 baris PostgREST) di Rekening, Dashboard, Laporan, Rekap, daftar Pengajuan, dan sortir ulang tanggal penetapan | Total & daftar terpotong DIAM-DIAM bila data >1000 baris | Semua memuat seluruh halaman data |
| Laporan menghitung realisasi "disetujui + dicairkan", Dashboard/Rekap hanya "dicairkan" | Angka realisasi berbeda antar menu | Disamakan: hanya "dicairkan" |
| Tabel Rekening urut acak (menurut ID) | Sulit mencari/memeriksa | Urut sub kegiatan > kode rekening |
| Logika sortir tanggal penetapan ditulis dua kali (satu versi tanpa paginasi) | Duplikasi + bug terpotong | Satu versi di `lib/anggaran/tahapan.ts` |
| Dropdown rekening di Pengajuan memuat semua tahun | Pilihan membingungkan | Hanya tahun aktif |
| Breadcrumb & pencarian cepat (Ctrl/Cmd+K) dibuat tapi tak pernah dipasang | Fitur mati | Dipasang di header |
| File mati: `fase1/2.patch`, `HAPUS.txt`, `ErrorPanel.tsx` | Sampah repo | Dihapus |

## Menu disusun ulang (menurut alur kerja)
Ringkasan · **Penganggaran** (Rekening & Pagu, Perbandingan, Pemeriksaan, Riwayat, Anggaran Kas) · Transaksi (Pengajuan, Kuitansi SPPD) · Laporan (Rekap, Laporan per PPTK/Kegiatan/Waktu - sebelumnya tersembunyi) · Data Pendukung (Pejabat, Penyedia, Pegawai, SBU) · Pengaturan (Periode, Pengaturan, Akun).

## Belum diubah - butuh keputusan Anda
1. **Server tidak menolak pengajuan belanja yang melebihi sisa pagu** (hanya peringatan di layar form). Disarankan tolak/konfirmasi di server; belum saya ubah karena mengubah alur kerja bendahara.
2. Simpan pengajuan (header+rincian+potongan) masih 3 langkah dengan rollback manual; idealnya satu fungsi SQL atomik seperti `terapkan_pagu`.
3. Beberapa pemformat rupiah lokal (`rp`) masih berbeda-beda (ada yang menampilkan desimal / "—") - sengaja tidak diseragamkan.
4. Belum diuji pada Supabase sungguhan; hanya typecheck, `next build`, uji SQL di PostgreSQL 16 tiruan, dan uji logika dengan data tiruan.

---
# Tahap 3: Penyederhanaan menu Penganggaran

Menu samping Penganggaran kini hanya 3: **Input Anggaran (DPA)** · **Bandingkan Antartahapan** · **Anggaran Kas**.
(Pemeriksaan & Riwayat tetap ada, dibuka dari halaman Input Anggaran atau pencarian cepat Ctrl/Cmd+K.)

| Ingin | Lakukan |
|---|---|
| **Tambah** belanja | Input Anggaran > **+ Tambah Belanja** (form 2 langkah; kode dicek ke katalog) |
| **Ubah** pagu | Tombol **Ubah** di baris > ubah angka pagu > Simpan |
| **Koreksi** kode / uraian / sumber dana | Tombol **Ubah** > buka "Koreksi kode, uraian, atau sumber dana" (berlaku semua tahapan, tercatat) |
| **Hapus** | Tombol **Hapus** di baris (ada konfirmasi; nilai lama tetap di Riwayat) |
| Banyak sekaligus | **Unggah dari Excel** (3 langkah) |
| Mulai tahapan baru | **Salin dari tahapan lain** |

Baris yang kemungkinan salah ditandai ⚠ langsung di daftar (dengan alasan), plus chip "Belanja baru". Setelah simpan/galat, pengguna kembali ke halaman asalnya.

---
# Tahap 4: Dashboard infografis interaktif
Komponen baru `components/DashboardCharts.tsx` (recharts, sudah ada di dependency) dipanggil dari `app/(dashboard)/page.tsx`. Tidak ada migrasi baru.
- **Serapan Anggaran**: gauge realisasi vs laju waktu tahun anggaran (penanda "sesuai / tertinggal").
- **Tren Realisasi**: per bulan (batang + garis kumulatif + laju ideal) atau per triwulan vs rencana Anggaran Kas.
- **Status Pengajuan**: donat, klik membuka daftar pengajuan berstatus itu.
- **Komposisi Pagu**: donat, ganti Kelompok Belanja / Sumber Dana.
- **Perlu Perhatian**: realisasi melebihi pagu, pengajuan menunggu persetujuan, belum dicairkan, draft, belanja tanpa PPTK.
- **Peringkat Serapan**: PPTK / Kegiatan / Sub Kegiatan, urut pagu / realisasi / %, tampilkan semua.
Realisasi tetap = status "dicairkan" (sama dengan Rekap & Laporan). Tabel Pengajuan Terbaru dan Laporan Realisasi tetap ada di bawahnya.
