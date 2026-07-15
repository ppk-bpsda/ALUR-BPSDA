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
