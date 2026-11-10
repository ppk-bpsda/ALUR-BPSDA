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
