-- =========================================================
-- Sebagian item di Katalog Elektronik INAPROC ternyata dikenakan
-- tambahan PPN 12% secara terpisah dari harga produk -- tapi TIDAK
-- SEMUA item, cuma sebagian (tergantung penyedia/produk masing-masing).
-- Toggle global "Harga sudah termasuk PPN" (di form Pengajuan) tidak
-- cukup untuk kasus ini karena berlaku untuk SATU pengajuan secara
-- keseluruhan, padahal kondisinya bisa campur dalam satu nota: sebagian
-- item harga sudah termasuk pajak, sebagian lagi dikenakan PPN
-- tambahan terpisah.
--
-- Solusi: flag ini per BARIS rincian, bukan per pengajuan. Kalau
-- dicentang, PPN untuk baris itu dihitung MAJU dari harga_satuan
-- (dianggap netto) dan dijumlahkan sebagai komponen 'tambahan' --
-- terpisah dari perhitungan PPN global pengajuan (yang tetap jalan
-- seperti biasa untuk baris-baris yang TIDAK dicentang).
-- =========================================================

alter table rincian_belanja add column if not exists kena_ppn_tambahan boolean not null default false;
