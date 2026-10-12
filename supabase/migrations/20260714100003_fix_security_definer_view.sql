-- =========================================================
-- FIX: Supabase database linter memperingatkan bahwa view
-- rekap_realisasi berjalan sebagai SECURITY DEFINER (memakai hak akses
-- pembuat view, bukan hak akses user yang query -- berpotensi
-- melewati RLS tabel di baliknya).
--
-- security_invoker=on membuat view berjalan dengan hak akses & RLS
-- milik user yang menjalankan query, bukan pemilik view. Tersedia
-- sejak Postgres 15 (Supabase sudah pakai versi ini).
-- =========================================================

alter view rekap_realisasi set (security_invoker = on);
