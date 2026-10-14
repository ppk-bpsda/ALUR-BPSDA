# SPJ Sekretariat Daerah - Kota Batu

Aplikasi pendamping penyusunan SPJ: master data anggaran (Program/Kegiatan/Sub
Kegiatan/Rekening/Pagu/PPTK), master Pejabat SKPD (KPA & Bendahara Pengeluaran
Pembantu), master Penyedia Barang/Jasa & Penerima (cari & pilih), pengajuan
belanja, dan generate otomatis 3 dokumen (Nota Dinas, SPP/SPTJB, Kwitansi GU)
dari satu sumber data yang sama.

Stack: **Next.js 14** (App Router) + **Supabase** (Postgres, Auth, RLS) +
**Vercel** (hosting) + **GitHub** (source control & CI/CD otomatis).

---

## 1. Struktur Project

```
app/
  login/                    halaman & server action login (akun Admin tunggal)
  (dashboard)/               semua halaman setelah login (dilindungi middleware.ts)
    page.tsx                 dashboard ringkasan
    pejabat/                 CRUD KPA & Bendahara Pengeluaran Pembantu
    pptk/                    CRUD PPTK per sub kegiatan
    penyedia/                database penyedia barang/jasa (cari & pilih)
    penerima/                database penerima uang GU (cari & pilih)
    rekening/                daftar rekening & pagu (DPA), edit tahapan/pagu
    pengajuan/                daftar pengajuan + form pengajuan baru + generate dokumen
    rekap/                    rekap realisasi vs pagu
  api/
    pengajuan/                POST: simpan pengajuan belanja + rincian + potongan
    generate-dokumen/         GET: isi template docx dari data pengajuan, download
lib/
  supabase/                   client Supabase (browser, server, service-role)
  terbilang.ts                 angka -> teks terbilang (dipakai otomatis di dokumen)
  format.ts                    format tanggal Bahasa Indonesia
  renderTemplate.ts            isi template docx pakai docxtemplater
templates/                     3 file .docx template (placeholder {field})
supabase/migrations/           skema database + seed dari DATABASE.xlsx
middleware.ts                  proteksi: harus login utk akses semua halaman
```

---

## 2. Setup Supabase (lakukan dulu sebelum deploy)

1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, jalankan isi file `supabase/migrations/20260714100001_init_schema_v2.sql`, klik Run.
3. Jalankan isi `supabase/migrations/20260714100002_seed_master_data_v2.sql`, klik Run.
4. Buka **Authentication > Providers > Email**, matikan **"Allow new users to sign up"**
   (aplikasi ini memang hanya untuk satu akun Admin, bukan pendaftaran umum).
5. Buka **Authentication > Users > Add User**, buat 1 akun Admin. **Penting:** karena
   Supabase Auth hanya mendukung login lewat email (tidak ada konsep username asli),
   aplikasi ini mengonversi username Anda menjadi email otomatis dengan pola
   `<username>@admin.local`. Jadi kalau Anda ingin login dengan username **admin**,
   isi kolom **Email** di Supabase dengan `admin@admin.local` (bukan email asli).
   Anda tetap bebas login pakai email betulan juga kalau mau -- aplikasi mendeteksi
   otomatis (kalau input mengandung "@", dipakai apa adanya).
6. Buka **Project Settings > API**, catat:
   - `Project URL` -> jadi `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` -> jadi `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret key` -> jadi `SUPABASE_SERVICE_ROLE_KEY` (JANGAN disebar, hanya dipakai server)

> **Catatan:** akun yang dibuat lewat Authentication tersimpan di skema `auth`
> (tabel `auth.users`), bukan skema `public` -- karena itu tidak akan terlihat
> di Table Editor kalau skema yang dipilih masih "public". Untuk mengelola akun
> Admin sehari-hari, cukup lewat halaman **Authentication > Users**, tidak perlu
> lewat Table Editor.

**Cek data setelah seed** (lihat juga `supabase/migrations/README.md` versi lama untuk detail):
- NIP PPTK masih placeholder `TBD` di beberapa baris -- lengkapi lewat halaman **PPTK**.
- Data KPA & Bendahara Pengeluaran Pembantu di-seed dari contoh dokumen lama -- cek ulang lewat halaman **Pejabat SKPD**.
- Semua pagu di-seed dengan tahapan `murni` -- sesuaikan lewat halaman **Rekening & Pagu** kalau perlu.

---

## 3. Jalankan di Lokal (opsional, untuk development)

```bash
npm install
cp .env.example .env.local
# isi .env.local dengan 3 nilai dari langkah 2 di atas
npm run dev
```
Buka `http://localhost:3000`, login pakai akun Admin yang dibuat di langkah 2.5.

---

## 4. Push ke GitHub

```bash
git init
git add .
git commit -m "Initial commit: SPJ Sekretariat Daerah"
git branch -M main
git remote add origin https://github.com/<username>/<nama-repo>.git
git push -u origin main
```

`.gitignore` sudah menyertakan `.env*` dan `node_modules` supaya kredensial tidak ikut ter-commit.

---

## 5. Deploy ke Vercel

1. Buka [vercel.com](https://vercel.com) -> **Add New... > Project** -> pilih repo GitHub yang baru di-push.
2. Vercel otomatis mendeteksi Next.js, tidak perlu ubah build settings.
3. Di step **Environment Variables**, tambahkan 4 variabel (nilai sama seperti `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_NAMA_SKPD`
4. Klik **Deploy**. Setelah selesai, Vercel memberi URL `https://<nama-project>.vercel.app`.
5. Setiap kali Anda `git push` ke branch `main`, Vercel otomatis build & deploy ulang (CI/CD otomatis, tidak perlu langkah manual lagi).

---

## 6. Pemakaian Bersamaan (3 orang)

Supabase & Vercel secara default sudah mendukung banyak koneksi/user bersamaan
tanpa konfigurasi tambahan -- 3 orang bisa login dari device berbeda dengan akun
Admin yang sama secara bersamaan. Yang perlu diperhatikan: karena semua orang
memakai **satu akun** yang sama, tidak ada pemisahan "siapa mengerjakan apa" di
level sistem -- itu perlu diatur secara manual/organisasi (misalnya lewat
pembagian tugas di luar aplikasi), karena sesuai desain awal, aplikasi ini
memang dibuat single-role Admin, bukan multi-akun dengan hak akses berbeda.

Jika ke depan Anda butuh 3 akun terpisah dengan jejak "siapa mengerjakan apa"
tercatat di database, itu perubahan skema (menambah tabel role) yang bisa
dikerjakan menyusul.

---

## 7. Yang Sudah Berfungsi vs. Yang Masih Perlu Dikembangkan

**Sudah jalan (end-to-end):**
- Login Admin tunggal, proteksi semua halaman.
- CRUD Pejabat SKPD, PPTK, Penyedia, Penerima.
- Lihat & edit pagu/tahapan DPA.
- Form Pengajuan Belanja (rincian item dinamis, potongan pajak) tersimpan ke database.
- Generate 3 dokumen (.docx) langsung dari data pengajuan, terbilang otomatis mengikuti nominal.
- Dashboard ringkasan pagu/realisasi/sisa + daftar pengajuan terbaru.
- Rekap realisasi per rekening.

**Masih sederhana / bisa dikembangkan lanjut:**
- Halaman Pengajuan belum punya fitur edit/hapus setelah tersimpan (baru create + generate dokumen; edit & hapus perlu ditambahkan sesuai kebutuhan rekap yang Anda sebutkan -- filter tahun anggaran/kode rekening/tanggal/nama penerima).
- Nomor Nota Dinas / Nomor Bukti belum ada penomoran otomatis (masih kosong, bisa diisi manual atau ditambahkan fungsi auto-number).
- Belum ada import massal Excel dari UI (skema & seed awal sudah lewat SQL migration; import lewat UI untuk update rutin bisa ditambahkan).
- Status pengajuan (draft/diajukan/disetujui/dicairkan) belum ada tombol ubah status di UI -- saat ini semua otomatis "draft" ketika dibuat.

Silakan lanjutkan pengembangan bagian-bagian ini sesuai prioritas, atau minta bantuan lagi kapan saja.

---

## 8. Pembaruan Keamanan & Perbaikan (Oktober 2026)

**Wajib dilakukan setelah men-deploy versi ini:**

1. Pastikan 3 Environment Variables terisi di Vercel (lihat `.env.example`), lalu **Redeploy**.
2. Jalankan `supabase/migrations/20260801000000_hardening_rls_admin_only.sql` di SQL Editor Supabase.
   Migrasi ini membatasi akses data hanya untuk akun yang punya profil Admin. Akun lama otomatis dibuatkan
   profil (backfill). Periksa daftar akun dengan query verifikasi di bagian bawah file migrasi, dan hapus akun
   yang tidak dikenal.
3. Supabase > Authentication > Providers > Email: **matikan "Allow new users to sign up"**.

**Perubahan utama:** seluruh `/api/*` kini wajib login; route import tidak lagi memakai service_role;
Next.js dinaikkan ke 15.5.x (versi 14 memiliki banyak advisori keamanan); login diperbaiki untuk akun
yang dibuat lewat menu Akses Aplikasi; validasi & pembulatan angka di server; penyimpanan pengajuan
dengan rollback; deteksi duplikat saat import; folder duplikat/halaman usang dihapus.

**Kemudahan pemakaian:** kesalahan isian di menu Rekening, Pejabat, Penyedia, Periode, Pengaturan, dan Akun
kini tampil sebagai banner merah berbahasa Indonesia di halaman yang sama (sebelumnya pegawai hanya melihat
halaman "terjadi kendala" tanpa penjelasan). Tombol hapus/ubah status juga aman bila koneksi putus.

## 9. Pemecahan Masalah: "Login tidak bisa diakses"

| Gejala | Penyebab & solusi |
|---|---|
| Pesan "Layanan database/autentikasi tidak dapat dihubungi" | Project Supabase gratis di-pause setelah ~7 hari tidak aktif. Buka dashboard Supabase > **Restore project**. |
| Pesan "Konfigurasi server belum lengkap" / halaman teks 503 | Env var Supabase belum diisi di Vercel. Isi lalu Redeploy. |
| "Username atau kata sandi salah" padahal benar | Pastikan akun terdaftar di tabel `profiles`; username tidak peka huruf besar/kecil. |
| Situs tidak terbuka sama sekali | Cek status deployment di Vercel (Deployments). Bila halaman Vercel normal dari jaringan lain, kemungkinan ISP memblokir `vercel.app`; coba DNS lain / data seluler. |
| Error saat generate dokumen (ENOENT) | Pastikan folder `templates/` ikut ter-commit. |

## 10. Catatan Teknis / Pekerjaan Lanjutan

- Library `xlsx` 0.18.5 memiliki advisori tanpa patch di npm. Risiko dikurangi (hanya admin login, batas 5 MB).
  Untuk menutup penuh: `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.
- Form pengajuan menghitung "sisa anggaran" dari semua tahapan, sedangkan dokumen memakai tahapan <= tahapan
  dokumen. Selaraskan sesuai aturan bisnis yang diinginkan.
- Tersedia `npm run typecheck`.

## 11. Pembaruan: Kecepatan Login, Tampilan, dan Administrasi Perjalanan Dinas

### 11.1 Langkah wajib setelah deploy
1. Supabase > SQL Editor > jalankan `supabase/migrations/20260802000000_administrasi_perjalanan_dinas.sql`
   (aman diulang; hanya **menambah** tabel berawalan `perjadin_`, bucket privat `perjalanan-dinas`, dan kolom
   `profiles.email` untuk mempercepat login. Tidak mengubah/menghapus data lama). Migrasi juga mengisi
   data awal **Data Pegawai (18 orang)** dan **SBU Uang Harian TA 2026 (35 tujuan)** dari file lampiran.
2. Tanpa migrasi, aplikasi lama tetap berjalan normal; menu baru menampilkan petunjuk untuk menjalankannya.

### 11.2 Penyebab login lemot & perbaikannya
- Middleware memanggil `auth.getUser()` (panggilan jaringan ke Supabase) di **setiap** klik menu -> kini cek sesi lokal
  (`getSession`); verifikasi otoritatif tetap di layout dashboard, semua API (`requireUser`) dan RLS.
- Login melakukan 2 panggilan berurutan sebelum sign-in -> kini 1 (email disimpan di `profiles.email`;
  akun lama terisi otomatis saat migrasi / login pertama).
- Dashboard menjalankan 6 query satu per satu -> kini paralel (`Promise.all`).
- Logo 963 KB + 296 KB dikecilkan menjadi 84 KB + 16 KB. Ditambah tombol "Memeriksa akun…" dan skeleton `loading.tsx`.
- **Cek wilayah (penting):** pastikan *Function Region* di Vercel (Settings > Functions) sedekat mungkin dengan region
  project Supabase (mis. keduanya Singapore/`sin1`). Region berbeda benua menambah ratusan ms pada setiap query.

### 11.3 Menu Administrasi Perjalanan Dinas
- **Kuitansi SPPD**: unggah Surat Tugas (+ Laporan opsional; .docx/.xlsx/.xls/.pdf, maks 4 MB) -> klik *Baca & isi
  otomatis* -> periksa/koreksi -> simpan -> unduh `.docx`. Satu halaman kuitansi per pegawai.
  Isian otomatis dicetak **merah**; tombol *Siap cetak* menghasilkan versi tanpa warna.
- **Data Pegawai** dan **SBU Uang Harian**: dapat diubah/diimpor ulang dari Excel (SBU per Tahun Anggaran).
- Program/kegiatan/sub kegiatan/belanja/kode rekening/PPTK diambil dari DPA yang ada; KPA & Bendahara dari menu Akun.
- Template: `templates/Template_Kuitansi_SPPD.docx` diturunkan langsung dari berkas contoh Template_Kwitansi_GU.docx (semua tabel, lebar kolom, huruf, dan bingkai sama; ditambah baris Program/Kegiatan/Sub Kegiatan). Tag `{...}` berwarna merah; dapat diedit di Word.
- PDF hasil scan (gambar) tidak dapat dibaca otomatis (tanpa OCR) -> isi formulir manual.
