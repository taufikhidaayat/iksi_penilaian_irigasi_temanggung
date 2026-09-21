-- =====================================================================
-- Jenis draf baru: "Bendung Baru", dari berkas GIS `SDY bendung Kab.dbf`.
--
-- Isinya bendung juga, tetapi BUKAN versi lain dari `01.BENDUNG.xlsx` yang
-- sudah ada: 584 baris (xlsx 594) dengan satu kolom tambahan, `UPT`. Dinas
-- perlu menyandingkan keduanya dulu sebelum memutuskan mana yang dipakai,
-- jadi keduanya disimpan berdampingan sebagai kartu terpisah, bukan saling
-- menimpa.
--
-- `bendung_baru` sengaja TIDAK dimasukkan ke menu Aset Irigasi (URUTAN_JENIS
-- di src/lib/aset.ts). Nilai enum ini hanya dipakai tabel draf; menambahkannya
-- ke daftar resmi akan memunculkan jenis aset yang tidak ada di Buku Aset.
--
-- ALTER TYPE ... ADD VALUE boleh berada di dalam transaksi sejak PostgreSQL 12
-- selama nilainya tidak dipakai di transaksi yang sama. Migrasi ini memang
-- hanya menambah nilainya; barisnya diisi belakangan oleh
-- `npm run impor-bendung-baru`.
-- =====================================================================

alter type jenis_aset add value if not exists 'bendung_baru';
