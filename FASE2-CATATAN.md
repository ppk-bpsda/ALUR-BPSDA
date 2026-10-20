# FASE 2 - Layout shell (ALUR-BPSDA)

Prasyarat: FASE 1 sudah terpasang. Salin isi folder ini ke root repo (timpa file yang sama), lalu
`npm run typecheck && npm run build`. Tanpa dependency baru, tanpa perubahan database/API/logika bisnis.
Perubahan atas file lama ada di `fase2.patch`.

BARU     : components/{Breadcrumbs,CommandPalette,ErrorPanel,nav-config}.ts(x), components/ui/PageSkeletons.tsx,
           app/(dashboard)/{template,error}.tsx, 17 file loading.tsx per segmen
DIUBAH   : tailwind.config.ts (+animasi page-in), components/{Sidebar,AccountMenu,MobileMenuButton}.tsx,
           components/ui/index.ts, app/(dashboard)/{layout,loading}.tsx, app/{error,not-found,global-error}.tsx

Uji cepat (npm run dev)
1. Sidebar desktop: klik "Ciutkan menu" -> ikon saja + tooltip; muat ulang -> tetap ciut (disimpan di cookie).
2. Ponsel (lebar <1024px): tombol menu -> drawer; Esc / klik latar / geser ke kiri menutup.
3. Ctrl+K (Cmd+K di Mac): cari "pengajuan", panah atas/bawah, Enter membuka halaman.
4. Header: breadcrumb mengikuti halaman; pill periode (klik -> /periode); menu akun bisa dipakai dengan keyboard.
5. Pindah antar-halaman: skeleton sesuai bentuk halaman + animasi masuk singkat.
6. Tab pertama kali: "Lewati ke konten" muncul.
