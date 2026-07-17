-- =========================================================
-- Tambahan kecil: kolom "Pangkat" di Pejabat SKPD, sesuai permintaan
-- form KPA/PPTK/BPP cukup: nama, nip, pangkat, jabatan. Penugasan PPTK
-- ke rekening tertentu sudah dilakukan di menu Rekening & Pagu (DPA)
-- lewat kolom dpa.pptk_id -- kolom pejabat_skpd.sub_kegiatan_id yang
-- lama TIDAK dihapus (supaya tidak kehilangan data lama) tapi sudah
-- tidak dipakai/diwajibkan lagi oleh form Pejabat SKPD.
-- =========================================================

alter table pejabat_skpd add column if not exists pangkat text;
