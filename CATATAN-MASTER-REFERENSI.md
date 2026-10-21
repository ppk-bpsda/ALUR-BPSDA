# Update Master Referensi ALUR (dari master_sianggaran.zip)

## Cara pasang (urut)
1. **Backup** database Supabase (Database > Backups) sebelum mulai.
2. Buka **Supabase > SQL Editor**, tempel & jalankan seluruh isi
   `supabase/migrations/20260803000000_lengkapi_master_referensi_sianggaran.sql`.
   Aman dijalankan ulang; satu transaksi (gagal = tidak ada yang berubah).
   Lihat tab *Messages/Notices* untuk laporan hasilnya.
   Prasyarat: migrasi `20260801000000_hardening_rls_admin_only.sql` sudah dijalankan.
3. Salin 3 file di folder `app/(dashboard)/rekening/` ke repo (timpa `page.tsx` & `actions.ts`,
   tambah `TambahRekeningFields.tsx`), lalu deploy. Urutan langkah 2 dan 3 bebas:
   bila kode lebih dulu naik, halaman tetap normal (kotak katalog tersembunyi sampai SQL dijalankan).

## Apa yang masuk ke database
| Master | Perlakuan |
|---|---|
| Program (2) | Sudah ada semua, tidak diubah |
| Kegiatan (9) | +1 baru (4.01.01.2.03), 8 lama dibiarkan |
| Sub Kegiatan (35) | +16 baru, 19 lama dibiarkan (2 nama kembar dikoreksi, lihat bawah) |
| Kode rekening belanja (157) | Masuk sebagai **katalog** `ref_belanja`, BUKAN baris rekening/pagu. Total 156 kode = 27 dari rekening ALUR + 129 dari master; 22 kode master identik dengan ALUR, 6 bentrok dilewati (lihat butir 1 dan 5 di bawah) |
| Sumber dana (2) | Katalog `ref_sumber_dana` (PAD, DBH CHT + nilai yang sudah terpakai) |
| PPTK (3) | Ketiganya sudah ada (dicocokkan tanpa gelar/huruf besar-kecil) -> tidak ada yang ditambah/diubah |

Kenapa kode belanja tidak jadi baris rekening: di ALUR rekening selalu melekat pada satu sub kegiatan + sumber
dana + pagu, sedangkan master tidak memuat relasi itu. Memasukkannya akan membuat ratusan rekening fiktif.

## Perubahan aplikasi (menu Rekening & Pagu)
- Form **Tambah Rekening**: kotak "Cari di Katalog Kode Rekening Belanja" -> otomatis mengisi kode lengkap
  (kode sub kegiatan + kode belanja), uraian, dan Jenis Rek. (5.2.* = Belanja Modal). Semua tetap bisa diedit.
- **Sumber Dana**: daftar pilihan (tetap boleh ketik nilai baru).
- Server: kode yang diisi pendek (6 segmen) otomatis dilengkapi; kode dengan awalan sub kegiatan yang salah
  ditolak; pagu negatif/bukan angka ditolak. Ini mencegah bug lama "rekening dobel kode pendek".

## Keamanan
Tabel baru ber-RLS: hanya akun Admin yang bisa **membaca**; tidak ada akses tulis dari browser; `anon` tertutup.

## Hasil uji
Diuji pada database tiruan yang dibangun dari seluruh migrasi repo (bukan database live Anda):
data lama (rekening, DPA, pejabat, program, kegiatan) identik sebelum/sesudah; jalan kedua = 0 perubahan;
tidak ada yatim/duplikat; RLS (anon, non-admin, admin) lolos; skenario tepi lolos; `tsc` dan `next build` lolos;
perilaku form diuji di DOM.

## PERLU KEPUTUSAN ANDA (tidak diubah otomatis)
1. **Kode Perjalanan Dinas Dalam Kota.** Master (dan sumber kodifikasi daerah lain yang saya cek) menetapkan
   `5.1.02.04.001.00003` = Dalam Kota, `...00004` = Paket Meeting Dalam Kota. Database ALUR memakai `...00004`
   untuk "Dalam Kota" (hasil rekonsiliasi lampiran DPA Anda, dan migrasi lama menghapus `...00003`).
   Katalog mengikuti ALUR agar selaras; data Anda tidak disentuh. **Cocokkan dengan DPA/SIPD resmi Anda.**
2. **NIP PPTK kosong.** Master hanya memuat nama. Nama lama tanpa gelar (mis. "Tengko Wolok") dipertahankan;
   gelar ada di master ("TENGKO WOLOK, S.T."). Ubah lewat menu Pejabat bila ingin gelar tampil di dokumen.
3. **2 nama kegiatan berbeda** (4.01.01.2.07 dan 2.09: "...Kabupaten/Kota" vs "...Pemerintahan Daerah"):
   nama ALUR dipertahankan.
4. **Koreksi yang dilakukan:** sub kegiatan 4.01.03.2.01.0004 & 0005 di DB bernama sama dengan 0003
   (salah salin) -> diganti nama resmi master, hanya bila belum punya rekening. Nama 4.01.01.2.09.0001 di master
   salah salin dari 2.09.0002; dimasukkan dengan nama resmi "Kendaraan Perorangan Dinas atau Kendaraan Dinas Jabatan".
5. Kode lama honorarium/jasa BMD di master (`5.1.02.02.001.00080`, `.00081`, `.00001`) tidak dimasukkan,
   karena ALUR sudah memakai kode yang dikoreksi (`5.1.01.03.007.00001/2`, `5.1.01.03.008.00002`).

## Catatan lain
- `master_referensi.sql` **sengaja tidak dijalankan**: membuat tabel `ref_*` paralel di luar struktur ALUR dan
  memakai `ON CONFLICT DO UPDATE` yang menimpa data.
- Tahun target migrasi = 2026 (variabel `v_tahun` di SQL). Ubah bila master ini untuk tahun lain.
- Temuan di luar tugas ini: `package-lock.json` tidak sinkron dengan `package.json` (`npm ci` gagal), dan
  `20260730030000 koreksi dpa id sesuai tanggal.sql` error saat saya putar ulang dari nol (alias tabel di subquery).
  Keduanya tidak saya ubah.
