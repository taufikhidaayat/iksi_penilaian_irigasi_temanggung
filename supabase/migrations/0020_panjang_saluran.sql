-- =====================================================================
-- Panjang saluran, supaya terbaca petugas saat mengisi penilaian.
--
-- Komponen I.2 "Saluran Pembawa" dinilai per ruas saluran. Tanpa panjangnya,
-- petugas hanya melihat deretan nomenklatur yang seragam dan tidak punya
-- pegangan sama sekali untuk memastikan ruas di layar adalah ruas yang sedang
-- ia periksa. Seluruh 4.642 saluran di register bernama sama persis, "Saluran
-- Sekunder", jadi panjang adalah salah satu dari sedikit keping yang benar-benar
-- membedakan satu ruas dari ruas lain.
--
-- Sumbernya kolom `panjang` pada berkas GIS `02.SALURAN FIX.xlsx`, satuannya
-- meter. Rentangnya 0 sampai 2.346 m dengan median 76 m.
--
-- `numeric`, bukan `real`: angka dari GIS punya belasan angka di belakang koma
-- dan akan ditampilkan dipotong dua angka. Tipe pecahan biner membuat
-- pemotongan itu bisa meleset satu angka di belakang koma pada nilai tertentu,
-- dan tidak ada gunanya menanggung risiko itu demi menghemat empat byte.
--
-- Boleh NULL: 229 dari 577 D.I. memang tidak punya saluran sama sekali di
-- berkas sumber mana pun, dan 43 saluran panjangnya tercatat 0. Memaksa angka
-- di kolom ini berarti mengarang data lapangan.
-- =====================================================================

alter table aset add column if not exists panjang numeric(12, 4);

comment on column aset.panjang is
  'Panjang saluran dalam meter, dari berkas GIS. Null bila belum terdata.';
