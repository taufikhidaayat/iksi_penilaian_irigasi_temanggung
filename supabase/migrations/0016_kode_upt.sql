-- =====================================================================
-- Segmen wilayah pada nomor aset: 2 digit UPT + 3 digit nomor D.I.
--
-- Melengkapi migrasi 0014 (golongan). Setelah ini nomor aset yang ditampilkan
-- memuat kedua keterangan sekaligus:
--
--     33 . 23 . 010306 . 01287 . 01001 . 2002
--     ^^   ^^     ^^      ^^ ^^    ^^^^^   ^^^^
--     prov kab  golongan  |   |    tipe &  tahun
--                         |   |    urut
--                         |   nomor D.I. (3 digit)
--                         UPT Regional (01..06)
--
-- Diminta Dinas supaya wilayah pengelola terbaca langsung dari nomornya.
-- Buku sumber memberi nomor yang seragam se-kabupaten, sehingga tanpa ini
-- nomor aset tidak menyatakan siapa yang mengelolanya.
--
-- ⚠️ Konsekuensi yang disadari: nomor di layar tidak lagi sama persis dengan
-- Buku Aset cetak. Nomor asli tetap tersimpan utuh di `aset.kode_buku` dan
-- `aset_draf.kode_draf`, keduanya tetap ikut dicari, jadi petugas yang
-- mengetik nomor dari berkas cetak tetap menemukan barisnya.
--
-- Yang TIDAK dikonversi (dibiarkan berformat buku, semuanya sudah
-- `perlu_tinjau`):
--   - aset tanpa `di_id`   -> UPT-nya tidak diketahui, menebak justru berbahaya
--   - nomor < 4 segmen     -> tidak punya segmen wilayah
--   - segmen ke-4 > 5 digit -> pada 13 baris, segmen ke-4 dan ke-5 tertulis
--     menyatu di buku; menimpanya akan ikut memusnahkan segmen ke-5
--
-- `kode_siksi` DIHAPUS: isinya kini persis sama dengan `kode`, dan dua kolom
-- yang wajib seiring hanya menunggu saatnya berselisih. Asal-usulnya tetap
-- terjaga lewat `kode_buku` / `kode_draf`.
--
-- Aman diulang: nilainya dihitung dari `daerah_irigasi`, bukan dari isi nomor
-- sebelumnya.
-- =====================================================================

do $$
declare
  di_terbesar int;
  n_aset      int;
  n_draf      int;
begin
  select max(substring(kode from 5)::int) into di_terbesar from daerah_irigasi;
  if di_terbesar >= 1000 then
    raise exception
      'Nomor D.I. terbesar % >= 1000, tidak muat di 3 digit segmen ke-4. '
      'Lebar segmen harus dinaikkan sebelum migrasi ini dijalankan.', di_terbesar;
  end if;

  update aset a
     set kode = concat_ws('.',
           split_part(a.kode, '.', 1),
           split_part(a.kode, '.', 2),
           split_part(a.kode, '.', 3),
           lpad(d.upt_id::text, 2, '0')
             || lpad(substring(d.kode from 5)::int::text, 3, '0'),
           split_part(a.kode, '.', 5),
           split_part(a.kode, '.', 6)
         )
    from daerah_irigasi d
   where d.id = a.di_id
     and d.upt_id is not null
     and a.kode is not null
     and array_length(string_to_array(a.kode, '.'), 1) = 6
     and length(split_part(a.kode, '.', 4)) <= 5
     and split_part(a.kode, '.', 4) is distinct from
         (lpad(d.upt_id::text, 2, '0')
            || lpad(substring(d.kode from 5)::int::text, 3, '0'));
  get diagnostics n_aset = row_count;

  update aset_draf x
     set kode = concat_ws('.',
           split_part(x.kode, '.', 1),
           split_part(x.kode, '.', 2),
           split_part(x.kode, '.', 3),
           lpad(d.upt_id::text, 2, '0')
             || lpad(substring(d.kode from 5)::int::text, 3, '0'),
           split_part(x.kode, '.', 5),
           split_part(x.kode, '.', 6)
         )
    from daerah_irigasi d
   where d.id = x.di_id
     and d.upt_id is not null
     and x.kode is not null
     and array_length(string_to_array(x.kode, '.'), 1) = 6
     and length(split_part(x.kode, '.', 4)) <= 5
     and split_part(x.kode, '.', 4) is distinct from
         (lpad(d.upt_id::text, 2, '0')
            || lpad(substring(d.kode from 5)::int::text, 3, '0'));
  get diagnostics n_draf = row_count;

  raise notice 'Segmen wilayah dipasang: % aset, % baris draf.', n_aset, n_draf;
end $$;

-- Nomor asli dari berkas draf tetap bisa dicari walau `kode` sudah berbeda.
update aset_draf
   set teks_cari = left(teks_cari || ' ' || kode_draf, 20000)
 where kode_draf is not null
   and position(kode_draf in teks_cari) = 0;

alter table aset      drop column if exists kode_siksi;
alter table aset_draf drop column if exists kode_siksi;

comment on column aset.kode is
  'Nomor aset berformat SIKSI: golongan di segmen ke-3, UPT + nomor D.I. di '
  'segmen ke-4. Nomor asli buku ada di kode_buku. TIDAK unik.';
comment on column aset_draf.kode is
  'Nomor aset berformat SIKSI. Nomor asli berkas draf ada di kode_draf.';
