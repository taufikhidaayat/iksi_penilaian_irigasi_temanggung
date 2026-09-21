-- =====================================================================
-- Nomor aset kembali memakai nomor ASLI dari sumbernya.
--
-- Migrasi 0010 menulis ulang `aset.kode` menjadi nomor bentukan sistem
-- (golongan pada segmen ke-3, UPT pada segmen ke-4). Nomor itu memang lebih
-- informatif, tetapi TIDAK ADA di berkas mana pun yang dipegang petugas:
-- tidak di Buku Aset Irigasi cetak, tidak di berkas draf GIS, tidak di KIB.
--
-- Akibatnya petugas yang sedang mengisi penilaian membaca nomor di layar yang
-- tidak bisa dicocokkan dengan nomor di berkasnya. Untuk sistem yang inti
-- kerjanya justru pencocokan bangunan, itu cacat yang serius.
--
-- Karena itu:
--   `aset.kode`       dikembalikan ke nomor asli buku (= `aset.kode_buku`)
--   `aset.kode_siksi` menyimpan nomor bentukan sistem, tidak ditampilkan
--
-- Hal yang sama berlaku untuk menu Data Aset Draf:
--   `aset_draf.kode`       dikembalikan ke nomor asli berkas (= `kode_draf`)
--   `aset_draf.kode_siksi` menyimpan nomor bentukan sistem
--
-- Tidak ada data yang hilang: kedua bentuk nomor tetap tersimpan, dan
-- pencarian tetap menjangkau keduanya. Migrasi aman diulang.
-- =====================================================================

alter table aset      add column if not exists kode_siksi text;
alter table aset_draf add column if not exists kode_siksi text;

comment on column aset.kode is
  'Nomor aset ASLI sebagaimana tertulis di Buku Aset Irigasi. TIDAK unik.';
comment on column aset.kode_siksi is
  'Nomor bentukan sistem (golongan + UPT, lihat migrasi 0010). Tidak ditampilkan.';
comment on column aset_draf.kode is
  'Nomor aset ASLI sebagaimana tertulis di berkas draf GIS.';
comment on column aset_draf.kode_siksi is
  'Nomor bentukan sistem (golongan + UPT). Tidak ditampilkan.';

do $$
declare
  n_aset int;
  n_draf int;
begin
  -- Simpan nomor bentukan sistem sebelum `kode` ditimpa. Baris yang nomornya
  -- memang tidak pernah dikonversi (kode = kode_buku) tidak punya nomor
  -- bentukan sistem, jadi `kode_siksi`-nya sengaja dibiarkan kosong.
  update aset
     set kode_siksi = kode
   where kode_siksi is null
     and kode_buku is not null
     and kode is distinct from kode_buku;

  update aset
     set kode = kode_buku
   where kode_buku is not null
     and kode is distinct from kode_buku;
  get diagnostics n_aset = row_count;

  update aset_draf
     set kode_siksi = kode
   where kode_siksi is null
     and kode_draf is not null
     and kode is distinct from kode_draf;

  update aset_draf
     set kode = kode_draf
   where kode_draf is not null
     and kode is distinct from kode_draf;
  get diagnostics n_draf = row_count;

  raise notice 'Nomor aset dikembalikan ke nomor asli: % aset, % baris draf.',
    n_aset, n_draf;
end $$;

create index if not exists aset_kode_siksi_idx      on aset (kode_siksi);
create index if not exists aset_draf_kode_siksi_idx on aset_draf (kode_siksi);
