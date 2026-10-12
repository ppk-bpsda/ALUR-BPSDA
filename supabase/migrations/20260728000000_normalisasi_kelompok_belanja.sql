-- Sebelum aturan "Jenis Rek. cuma 2 pilihan" (Belanja Barang/Jasa atau
-- Belanja Modal) dibuat, kolom rekening_belanja.kelompok_belanja diisi
-- bebas lewat datalist (Belanja Operasi, Belanja Modal, Belanja Tidak
-- Terduga, Belanja Transfer) -- lihat catatan pegawai tanggal 2026-07-28:
-- kolom "Jenis Rek." di Nota Dinas masih menampilkan "Belanja Operasi".
--
-- Migrasi ini menormalkan data LAMA yang sudah tersimpan:
--   - Kalau nilainya sudah eksak 'Belanja Barang/Jasa' atau 'Belanja Modal', dibiarkan.
--   - Kalau mengandung kata "Modal" (mis. "Belanja Modal"), disamakan jadi 'Belanja Modal'.
--   - Selain itu (termasuk "Belanja Operasi", "Belanja Tidak Terduga",
--     "Belanja Transfer", atau kosong/null) -- default ke 'Belanja Barang/Jasa',
--     karena aplikasi ini pada dasarnya dipakai untuk pengajuan pengadaan
--     barang/jasa. Kalau ternyata ada baris yang sebetulnya Belanja Modal,
--     betulkan manual lewat halaman Rekening & Pagu (sudah jadi dropdown 2
--     pilihan) atau lewat panel "Jenis Rek." di form Pengajuan Belanja.
update rekening_belanja
set kelompok_belanja = case
  when kelompok_belanja ilike '%modal%' then 'Belanja Modal'
  else 'Belanja Barang/Jasa'
end
where coalesce(kelompok_belanja, '') not in ('Belanja Barang/Jasa', 'Belanja Modal');
