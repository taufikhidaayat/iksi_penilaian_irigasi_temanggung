-- =====================================================================
-- Data Aset Draf IKSI — hasil pendataan lapangan berbasis GIS.
--
-- Sumber: 8 berkas .xlsx di `data/aset-draf/` (10.682 baris). Tiap berkas
-- satu jenis aset, satu sheet, baris pertama header. Susunan kolomnya
-- berbeda-beda: Bendung 62 kolom, Tanah Saluran 12.
--
-- Karena itu kolomnya TIDAK dijadikan kolom tabel. Satu baris draf disimpan
-- apa adanya di `data` (jsonb), dan urutan kolom aslinya disimpan sekali per
-- jenis di `aset_draf_berkas.kolom`. Dengan begitu ekspor bisa menyusun ulang
-- berkas dengan kolom yang persis sama, dan menambah jenis baru tidak perlu
-- migrasi lagi.
--
-- Draf ini SENGAJA tidak bertahun. Isinya belum tentu sinkron dengan tabel
-- `aset`, dan memang dipakai sebagai bahan pembanding, bukan sumber resmi.
-- =====================================================================

create table aset_draf_berkas (
  jenis        jenis_aset primary key,
  /** Nama berkas asli, untuk tombol unduh berkas apa adanya. */
  nama_berkas  text not null,
  /** Nama sheet di berkas asli; dipakai lagi saat ekspor. */
  nama_sheet   text not null,
  /** Urutan nama kolom apa adanya, mis. ["LAYER","Keterangan","X",…]. */
  kolom        jsonb not null,
  /** Kolom yang memuat nomor aset, mis. "Nomor.Bang". Null bila tidak ada. */
  kolom_kode   text,
  jumlah_baris int  not null default 0,
  diimpor_pada timestamptz not null default now()
);

create table aset_draf (
  id        bigint generated always as identity primary key,
  jenis     jenis_aset not null references aset_draf_berkas (jenis) on delete cascade,
  /** Nomor baris di berkas asli (header = 1), supaya urutan bisa dipulihkan. */
  baris_ke  int not null,

  /** Nomor aset setelah kodefikasi golongan + UPT (lihat migrasi 0010). */
  kode      text,
  /** Nomor aset apa adanya di berkas draf, sebelum kodefikasi. */
  kode_draf text,
  di_id     bigint references daerah_irigasi (id) on delete set null,

  /** Seluruh kolom baris ini, {nama kolom: nilai}. */
  data      jsonb not null,
  /** Seluruh nilai digabung, hanya untuk pencarian ILIKE lintas kolom. */
  teks_cari text not null default '',

  unique (jenis, baris_ke)
);

create index on aset_draf (jenis);
create index on aset_draf (kode);
create index on aset_draf (di_id);

-- ------------------------------------------------------------------ RLS
alter table aset_draf_berkas enable row level security;
alter table aset_draf        enable row level security;

-- Draf belum terverifikasi, jadi hanya admin yang boleh melihatnya. Petugas
-- UPT memakai menu Aset Irigasi yang datanya sudah resmi.
create policy "admin kelola berkas draf" on aset_draf_berkas
  for all to authenticated using (is_admin()) with check (is_admin());

create policy "admin kelola aset draf" on aset_draf
  for all to authenticated using (is_admin()) with check (is_admin());

comment on table aset_draf is
  'Data aset draf IKSI dari pendataan GIS. Bahan pembanding, bukan sumber resmi.';
