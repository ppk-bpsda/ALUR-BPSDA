# FASE 1 - Design system (ALUR-BPSDA)

Cara pasang: salin isi folder ini ke root repo (timpa file yang sama), lalu
`npm run typecheck && npm run build`. Tidak ada dependency baru, tidak ada perubahan database.
Perubahan atas 3 file lama dapat dilihat di `fase1.patch`.

File lama yang diubah : tailwind.config.ts, app/globals.css, app/layout.tsx
File baru             : app/fonts/*, components/ui/*, app/(dashboard)/dev-ui/*

Uji cepat
1. `npm run dev`, login, buka /dev-ui (404 di produksi) - lihat semua komponen.
2. Buka halaman lama (dashboard, pengajuan, rekening): tombol/isian/kartu berkelas lama
   kini bergaya baru; layout tidak boleh bergeser.
3. Buka /dokumen/<id>/nota_dinas, bandingkan dengan sebelum perubahan: kertas harus identik.

Tidak diubah dengan sengaja: aturan global `thead th`, `table`, `h1-h3` (dipakai halaman cetak
dokumen), warna teks body (slate-800, diwarisi dokumen), semua halaman fitur, logika bisnis, API, DB.
