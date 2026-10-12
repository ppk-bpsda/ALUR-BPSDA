-- ---------------------------------------------------------
-- Fix: Security Definer View pada public.rekap_realisasi
-- ---------------------------------------------------------
-- Supabase Database Linter menandai view ini sebagai ERROR (security_definer_view)
-- karena dibuat tanpa opsi security_invoker, sehingga secara default berjalan
-- dengan hak akses OWNER view (mem-bypass Row Level Security dari user yang query),
-- bukan hak akses user yang sedang login.
--
-- Fix ini membuat view berjalan dengan hak akses USER YANG QUERY (security invoker),
-- sehingga RLS pada tabel dasar (dpa, rekening_belanja, sub_kegiatan, pengajuan_belanja)
-- tetap berlaku normal saat diakses lewat view ini.
--
-- Referensi: https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view
-- ---------------------------------------------------------

alter view public.rekap_realisasi set (security_invoker = true);
