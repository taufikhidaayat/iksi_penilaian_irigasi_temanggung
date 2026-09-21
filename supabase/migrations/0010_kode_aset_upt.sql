-- =====================================================================
-- Kodefikasi ulang nomor aset: golongan pada segmen ke-3, UPT pada segmen ke-4.
--
-- Buku sumber memberi setiap aset nomor yang seragam, sehingga wilayah
-- pengelola dan golongan aset tidak terbaca dari nomornya:
--
--     33.23.010306.0287.12001.2002
--
-- Dua segmen sekarang dibuat berbicara:
--
--   segmen ke-3  golongan aset  01 = bangunan (BAB III), 02 = tanah (BAB IV)
--   segmen ke-4  UPT + D.I.     2 digit UPT (01..06) + 3 digit nomor D.I.
--
--     33.23.020306.01287.12001.2002
--            ^^      ^^
--            tanah   Regional I
--
-- Nomor D.I. cukup 3 digit: master berisi 577 D.I. (001..577). Migrasi
-- berhenti dengan galat bila suatu saat ada nomor D.I. >= 1000, daripada
-- diam-diam memotong digit.
--
-- Nomor asli dari buku disimpan di kolom `kode_buku` supaya konversi ini
-- bisa ditelusuri, dan diulang, tanpa mengimpor ulang dari .docx.
--
-- Baris yang TIDAK dikonversi (337 baris, semuanya sudah `perlu_tinjau`):
--   - 144 tanpa nomor aset
--   -  13 nomornya tidak 6 segmen
--   - 193 kode D.I.-nya tidak dikenali, jadi UPT-nya tidak diketahui
-- Baris itu dibiarkan apa adanya; menebak UPT-nya justru menyembunyikan
-- pekerjaan perapian yang memang harus dilakukan petugas.
-- =====================================================================

alter table aset add column if not exists kode_buku text;

comment on column aset.kode_buku is
  'Nomor aset asli dari BUKU ASET IRIGASI 2026, sebelum kodefikasi golongan + UPT.';

-- Hanya diisi sekali: jalan ulang tidak boleh menimpa nomor asli dengan
-- nomor yang sudah dikonversi.
update aset set kode_buku = kode where kode_buku is null and kode is not null;

do $$
declare
  di_terbesar int;
  diubah      int;
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
           case when a.jenis in (
                  'bendung', 'saluran', 'sadap', 'saluran_pelimpah',
                  'terjunan', 'talang', 'gorong_gorong', 'bangunan_pengaman'
                ) then '010306' else '020306' end,
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
     -- Hanya nomor yang masih berformat buku; yang sudah dikonversi dilewati
     -- supaya migrasi ini aman diulang.
     and split_part(a.kode, '.', 3) = '010306'
     and length(split_part(a.kode, '.', 4)) <= 4;

  get diagnostics diubah = row_count;
  raise notice 'Nomor aset dikodefikasi ulang: % baris.', diubah;
end $$;
