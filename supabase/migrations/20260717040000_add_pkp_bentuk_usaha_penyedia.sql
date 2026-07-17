-- =========================================================
-- Tambahan untuk kalkulator pajak yang lebih akurat: status PKP
-- (Pengusaha Kena Pajak) dan bentuk penyedia (Badan Usaha/Perseorangan).
-- Status PKP menentukan apakah PPN boleh/wajib dipungut -- penyedia
-- Non-PKP tidak boleh menerbitkan Faktur Pajak sehingga transaksinya
-- tidak dipungut PPN sama sekali (bukan 0%, tapi memang bukan objek
-- pemungutan PPN oleh Bendahara).
-- =========================================================

alter table penyedia add column if not exists status_pkp boolean not null default false;
alter table penyedia add column if not exists bentuk_usaha text not null default 'badan_usaha'
  check (bentuk_usaha in ('badan_usaha', 'perseorangan'));
