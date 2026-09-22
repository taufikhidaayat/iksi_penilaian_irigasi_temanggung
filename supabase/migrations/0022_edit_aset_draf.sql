-- =====================================================================
-- Menandai baris draf yang ditambah atau diubah manual di aplikasi.
--
-- Menu Aset Draf sebelumnya murni baca saja: bahan pembanding yang isinya
-- dijamin persis apa yang dikirim GIS. Sekarang admin bisa membetulkan
-- kesalahan ketik sebelum ekspor, dan menambah baris yang memang belum
-- terdata di berkas GIS-nya.
--
-- Tanpa penanda ini, baris hasil suntingan manual tidak bisa dibedakan dari
-- baris asli GIS, dan modul ini diam-diam berhenti jadi pembanding yang
-- jujur — persis alasan kolom `massal` ada pada nilai per bangunan
-- (penilaian_aset_nilai) dan `perlu_tinjau` pada aset resmi.
-- =====================================================================

alter table aset_draf
  add column diedit_manual boolean not null default false,
  add column diubah_oleh   uuid references profil (id) on delete set null,
  add column diubah_pada   timestamptz;

comment on column aset_draf.diedit_manual is
  'true bila baris ini ditambah atau nilainya diubah manual di aplikasi, bukan apa adanya dari impor GIS.';
comment on column aset_draf.diubah_oleh is
  'Administrator yang terakhir menambah/mengubah baris ini secara manual. Null bila belum pernah.';
