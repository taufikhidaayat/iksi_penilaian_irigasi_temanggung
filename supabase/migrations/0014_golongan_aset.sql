-- =====================================================================
-- Segmen golongan pada nomor aset: 01 bangunan, 02 tanah.
--
-- Buku Aset menulis `010306` pada segmen ke-3 untuk SELURUH aset, termasuk
-- 1.615 aset tanah. Diperiksa ke dua sumber sekaligus, dan tidak ada satu pun
-- pengecualian:
--
--     Buku Aset (.docx)      11.467 baris  -> semuanya 010306
--     Berkas draf GIS (.xlsx) 9.924 baris  -> semuanya 010306
--
-- Akibatnya golongan aset tidak terbaca dari nomornya sama sekali. Atas
-- keputusan Dinas, segmen itu sekarang dibuat berbicara:
--
--     33.23.[01]0306.0538.01001.2002   bangunan irigasi (BAB III)
--     33.23.[02]0306.0287.12001.2002   aset tanah       (BAB IV)
--
-- Golongan 02 mencakup 8 jenis, dari Tanah Saluran sampai Jalan Inspeksi:
--   tanah_saluran, tanah_bangunan_saluran, tanah_saluran_ma,
--   tanah_lambiran_sungai, tanah_lambiran_saluran, tanah_rumah,
--   tanah_tidak_tersedia_kib, jalan_inspeksi.
--
-- ⚠️ SEGMEN KE-4 TIDAK DISENTUH. Nomor D.I. tetap 4 digit seperti di buku,
-- tanpa awalan UPT. Itu disengaja: yang berubah dari nomor cetak hanya SATU
-- digit pada aset tanah, sehingga petugas tetap bisa mencocokkan nomor di
-- layar dengan berkas yang dipegangnya. Bentuk lama yang juga memuat kode UPT
-- tetap tersimpan di `kode_siksi` dan tetap ikut dicari, supaya nomor yang
-- terlanjur dicatat orang masih bisa ditemukan.
--
-- Nomor asli apa adanya tetap tersimpan di `aset.kode_buku` dan
-- `aset_draf.kode_draf`. Migrasi ini aman diulang: golongan dihitung dari
-- jenis asetnya, bukan dari isi nomor sebelumnya.
-- =====================================================================

comment on column aset.kode is
  'Nomor aset dari Buku Aset, dengan segmen ke-3 dibetulkan menurut golongan '
  '(01 bangunan, 02 tanah). Segmen lain apa adanya. TIDAK unik.';
comment on column aset_draf.kode is
  'Nomor aset dari berkas draf, dengan segmen ke-3 dibetulkan menurut golongan.';

do $$
declare
  n_aset int;
  n_draf int;
begin
  update aset a
     set kode = concat_ws('.',
           split_part(a.kode, '.', 1),
           split_part(a.kode, '.', 2),
           case when a.jenis in (
                  'bendung', 'saluran', 'sadap', 'saluran_pelimpah',
                  'terjunan', 'talang', 'gorong_gorong', 'bangunan_pengaman'
                ) then '010306' else '020306' end,
           split_part(a.kode, '.', 4),
           split_part(a.kode, '.', 5),
           split_part(a.kode, '.', 6)
         )
   where a.kode is not null
     and array_length(string_to_array(a.kode, '.'), 1) = 6
     -- Hanya baris yang segmen golongannya belum sesuai, supaya `updated_at`
     -- tidak ikut bergeser pada baris yang sebetulnya tidak berubah.
     and split_part(a.kode, '.', 3) is distinct from
         (case when a.jenis in (
                 'bendung', 'saluran', 'sadap', 'saluran_pelimpah',
                 'terjunan', 'talang', 'gorong_gorong', 'bangunan_pengaman'
               ) then '010306' else '020306' end);
  get diagnostics n_aset = row_count;

  update aset_draf d
     set kode = concat_ws('.',
           split_part(d.kode, '.', 1),
           split_part(d.kode, '.', 2),
           case when d.jenis in (
                  'bendung', 'saluran', 'sadap', 'saluran_pelimpah',
                  'terjunan', 'talang', 'gorong_gorong', 'bangunan_pengaman'
                ) then '010306' else '020306' end,
           split_part(d.kode, '.', 4),
           split_part(d.kode, '.', 5),
           split_part(d.kode, '.', 6)
         )
   where d.kode is not null
     and array_length(string_to_array(d.kode, '.'), 1) = 6
     and split_part(d.kode, '.', 3) is distinct from
         (case when d.jenis in (
                 'bendung', 'saluran', 'sadap', 'saluran_pelimpah',
                 'terjunan', 'talang', 'gorong_gorong', 'bangunan_pengaman'
               ) then '010306' else '020306' end);
  get diagnostics n_draf = row_count;

  raise notice 'Segmen golongan dibetulkan: % aset, % baris draf.', n_aset, n_draf;
end $$;

-- Nomor asli tetap ikut dicari lewat `teks_cari` pada menu Draf, jadi petugas
-- yang mengetik nomor persis seperti di berkas tetap menemukan barisnya.
update aset_draf
   set teks_cari = left(teks_cari || ' ' || kode, 20000)
 where kode is not null
   and position(kode in teks_cari) = 0;
