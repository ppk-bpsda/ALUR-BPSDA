-- =========================================================
-- Koreksi retroaktif: pengajuan_belanja yang SUDAH TERLANJUR tersimpan
-- dengan dpa_id tahapan yang salah (mis. tercatat ke DPA Pergeseran
-- padahal tanggal transaksinya sebelum 16 Maret 2026 -- itu terjadi
-- karena form lama mengikuti periode AKTIF saat input, bukan tanggal
-- transaksi). Jalankan SETELAH migrasi
-- 20260730020000_set_tanggal_penetapan_pergeseran.sql.
--
-- Untuk tiap pengajuan, cari ulang dpa yang SEHARUSNYA berlaku pada
-- rekening & tanggal transaksi yang sama (logika identik dengan
-- resolveDpaId di components/PengajuanForm.tsx), lalu pindahkan
-- dpa_id-nya kalau ternyata beda dari yang tersimpan sekarang.
-- Pagu tiap dpa TIDAK diubah -- hanya referensi pengajuan yang dirapikan.
-- =========================================================

do $$
declare
  v_jumlah int;
begin
  with terkoreksi as (
    update pengajuan_belanja p
    set dpa_id = benar.id
    from dpa d_asal
    cross join lateral (
      select d2.id
      from dpa d2
      where d2.rekening_id = d_asal.rekening_id
        and d2.tahun_anggaran = d_asal.tahun_anggaran
        and (d2.tanggal_penetapan is null or d2.tanggal_penetapan <= p.tanggal)
      order by d2.tanggal_penetapan desc nulls last
      limit 1
    ) as benar
    where d_asal.id = p.dpa_id
      and benar.id is distinct from p.dpa_id
    returning p.id
  )
  select count(*) into v_jumlah from terkoreksi;

  raise notice '% pengajuan_belanja dipindahkan ke dpa (tahapan) yang benar sesuai tanggal transaksinya.', v_jumlah;
end $$;
