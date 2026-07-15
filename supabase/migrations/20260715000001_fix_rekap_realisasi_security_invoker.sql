-- ---------------------------------------------------------
-- Fix: Security Definer View lint error (rekap_realisasi)
-- View sebelumnya berjalan dengan hak akses pembuat (owner),
-- bukan hak akses user yang query, sehingga RLS di tabel
-- dpa / rekening_belanja / sub_kegiatan / pengajuan_belanja
-- tidak diperhitungkan dengan benar. security_invoker = true
-- membuat view menghormati RLS milik user yang login.
-- ---------------------------------------------------------
alter view public.rekap_realisasi set (security_invoker = true);
