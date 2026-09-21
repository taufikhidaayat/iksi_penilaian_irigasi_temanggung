-- =====================================================================
-- Melengkapi migrasi 0014 untuk nomor aset yang formatnya tidak baku.
--
-- Migrasi 0014 hanya menyentuh nomor yang persis 6 segmen, sehingga 13 baris
-- terlewat: pada buku sumber, segmen ke-4 dan ke-5 baris itu tertulis menyatu.
--
--     33.23.010306.0010501001.2002      <- 5 segmen, bukan 6
--                  ^^^^^^^^^^
--                  "00105" dan "01001" menyatu
--
-- Padahal segmen golongannya sendiri tidak ikut rusak dan tetap bisa
-- dibetulkan. Dibiarkan berarti tiga aset tanah tampil bergolongan bangunan.
--
-- Karena itu penggantiannya di sini menyasar segmen ke-3 saja lewat regex,
-- dan menyalin sisa nomornya apa adanya. Penyatuan segmen ke-4 dan ke-5
-- SENGAJA tidak ikut dibetulkan: memisahkannya berarti menebak di mana batas
-- yang benar, sedangkan baris-baris itu sudah bertanda `perlu_tinjau` dan
-- memang harus dirapikan petugas yang memegang bukunya.
--
-- Aman diulang, dan aman pula dijalankan atas nomor yang sudah benar.
-- =====================================================================

do $$
declare
  n_aset int;
  n_draf int;
begin
  update aset a
     set kode = regexp_replace(
           a.kode,
           '^([^.]*\.[^.]*\.)[^.]*',
           '\1' || case when a.jenis in (
                          'bendung', 'saluran', 'sadap', 'saluran_pelimpah',
                          'terjunan', 'talang', 'gorong_gorong', 'bangunan_pengaman'
                        ) then '010306' else '020306' end
         )
   where a.kode is not null
     and array_length(string_to_array(a.kode, '.'), 1) >= 3
     and split_part(a.kode, '.', 3) is distinct from
         (case when a.jenis in (
                 'bendung', 'saluran', 'sadap', 'saluran_pelimpah',
                 'terjunan', 'talang', 'gorong_gorong', 'bangunan_pengaman'
               ) then '010306' else '020306' end);
  get diagnostics n_aset = row_count;

  update aset_draf d
     set kode = regexp_replace(
           d.kode,
           '^([^.]*\.[^.]*\.)[^.]*',
           '\1' || case when d.jenis in (
                          'bendung', 'saluran', 'sadap', 'saluran_pelimpah',
                          'terjunan', 'talang', 'gorong_gorong', 'bangunan_pengaman'
                        ) then '010306' else '020306' end
         )
   where d.kode is not null
     and array_length(string_to_array(d.kode, '.'), 1) >= 3
     and split_part(d.kode, '.', 3) is distinct from
         (case when d.jenis in (
                 'bendung', 'saluran', 'sadap', 'saluran_pelimpah',
                 'terjunan', 'talang', 'gorong_gorong', 'bangunan_pengaman'
               ) then '010306' else '020306' end);
  get diagnostics n_draf = row_count;

  raise notice 'Golongan pada nomor tak baku dibetulkan: % aset, % baris draf.',
    n_aset, n_draf;
end $$;

update aset_draf
   set teks_cari = left(teks_cari || ' ' || kode, 20000)
 where kode is not null
   and position(kode in teks_cari) = 0;
