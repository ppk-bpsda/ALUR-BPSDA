-- =========================================================
-- Latar belakang: sejak pembaruan sistem penghitungan pajak di
-- Katalog Elektronik LKPP (berlaku mulai Surat Pesanan per 16 Juli
-- 2025, selaras dengan Coretax), harga produk yang tampil di
-- "Ringkasan Pesanan" e-katalog TIDAK LAGI otomatis termasuk PPN --
-- PPN/PPnBM sekarang dihitung terhadap TOTAL nilai transaksi dan
-- ditampilkan sebagai komponen TERPISAH di Surat Pesanan/Invoice,
-- bukan dilebur ke harga satuan seperti skema lama.
--
-- Dampaknya ke aplikasi ini: PPN pada transaksi semacam ini bukan
-- lagi "dipotong dari" harga yang sudah termasuk pajak (mengurangi
-- yang diterima penyedia), melainkan "ditambahkan di atas" harga
-- netto (menambah total tagihan yang harus dibayar). Supaya kalkulator
-- & dokumen (Kwitansi) bisa membedakan dua skema ini, potongan_pajak
-- perlu tahu apakah satu baris pajak sifatnya:
--  - 'potongan'  -> mengurangi Jumlah Diterima Penyedia (skema lama,
--                   default -- PPh 21/22/23/Final selalu begini, PPN
--                   juga begini kalau harga sudah termasuk pajak)
--  - 'tambahan'  -> menambah Total Tagihan/DPA yang dibebankan (PPN
--                   ketika harga yang diinput adalah harga netto/
--                   belum termasuk pajak)
-- =========================================================

alter table potongan_pajak add column if not exists tipe text not null default 'potongan'
  check (tipe in ('potongan', 'tambahan'));
