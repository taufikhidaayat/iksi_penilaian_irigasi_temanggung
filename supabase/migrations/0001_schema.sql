-- =====================================================================
-- IKSI — Indeks Kinerja Sistem Irigasi
-- Dinas PUPR Kabupaten Temanggung
-- Skema inti: master data, penilaian, RLS per UPT.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- tipe
create type peran_pengguna as enum ('admin', 'upt');
create type status_penilaian as enum ('draft', 'diajukan', 'disetujui', 'revisi');
create type opsi_kantong_lumpur as enum ('ada', 'tidak');
create type periode_triwulan as enum ('TW I', 'TW II', 'TW III', 'TW IV');

-- Cara node menurunkan nilai dari anaknya (lihat src/lib/iksi/types.ts).
create type agregasi_indikator as enum (
  'leaf', 'weighted_children', 'sum_children', 'sum_children_div100'
);

-- ----------------------------------------------------------------- upt
create table upt (
  id       smallint primary key,
  kode     text     not null unique,
  nama     text     not null,
  urutan   smallint not null
);
comment on table upt is 'Enam UPT Regional pengelola daerah irigasi.';

-- ------------------------------------------------------------- pengguna
create table profil (
  id         uuid primary key references auth.users (id) on delete cascade,
  nama       text not null,
  peran      peran_pengguna not null default 'upt',
  upt_id     smallint references upt (id),
  aktif      boolean not null default true,
  created_at timestamptz not null default now(),
  -- Akun UPT wajib terikat pada satu UPT; admin tidak boleh terikat.
  constraint profil_upt_sesuai_peran check (
    (peran = 'upt'   and upt_id is not null) or
    (peran = 'admin' and upt_id is null)
  )
);

-- -------------------------------------------------------- daerah irigasi
create table daerah_irigasi (
  id               bigint generated always as identity primary key,
  kode             text not null unique,
  nama             text not null,
  kecamatan        text,
  desa             text,
  luas_baku        numeric(12, 3),
  luas_potensial   numeric(12, 3),
  luas_fungsional  numeric(12, 3),
  upt_id           smallint references upt (id),
  aktif            boolean not null default true
);
create index on daerah_irigasi (upt_id) where aktif;
create index on daerah_irigasi using gin (to_tsvector('simple', nama));

-- ------------------------------------------------------------ indikator
-- Katalog master 270 node, hasil ekstraksi "PENILAIAN IKSI (MASTER).xlsx".
-- Sumber kebenaran perhitungan ada di src/lib/iksi/; tabel ini untuk
-- integritas referensial dan pelaporan sisi SQL.
create table indikator (
  kode             text primary key,
  nomor            text not null,
  level            smallint not null,
  urutan           int not null unique,
  parent_kode      text references indikator (kode),
  label            text not null,
  bobot_ada        numeric(8, 4) not null,
  bobot_tidak      numeric(8, 4) not null,
  bobot_label      text not null,
  agregasi         agregasi_indikator not null,
  cond_jelek       text,
  cond_sedang      text,
  cond_baik        text,
  cond_baik_sekali text,
  catatan          text
);
create index on indikator (parent_kode);

-- ------------------------------------------------------------ penilaian
create table penilaian (
  id              uuid primary key default gen_random_uuid(),
  di_id           bigint   not null references daerah_irigasi (id) on delete restrict,
  upt_id          smallint not null references upt (id),
  tahun           smallint not null check (tahun between 2000 and 2100),
  triwulan        periode_triwulan not null,
  kantong_lumpur  opsi_kantong_lumpur not null default 'ada',
  status          status_penilaian not null default 'draft',

  jumlah_p3a      integer check (jumlah_p3a  >= 0),
  jumlah_gp3a     integer check (jumlah_gp3a >= 0),

  -- Hasil hitung yang dibekukan saat simpan, supaya rekap & ekspor tidak
  -- perlu menghitung ulang 270 node untuk ratusan D.I.
  total           numeric(7, 3),
  skor_komponen   jsonb,
  jml_terisi      smallint,
  jml_indikator   smallint,

  catatan         text,
  dibuat_oleh     uuid references profil (id),
  diajukan_pada   timestamptz,
  diverifikasi_oleh uuid references profil (id),
  diverifikasi_pada timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (di_id, tahun, triwulan)
);
create index on penilaian (upt_id, tahun, triwulan);
create index on penilaian (tahun, triwulan, status);

-- ------------------------------------------------------ nilai indikator
create table penilaian_nilai (
  penilaian_id   uuid not null references penilaian (id) on delete cascade,
  indikator_kode text not null references indikator (kode) on delete restrict,
  nilai          smallint not null check (nilai between 0 and 100),
  keterangan     text,
  primary key (penilaian_id, indikator_kode)
);

-- ------------------------------------------------------ areal terdampak
-- Kolom 4-9 template rekap "Areal Terdampak dan IKSI" (satuan hektar).
create table areal_terdampak (
  penilaian_id             uuid primary key references penilaian (id) on delete cascade,
  bangunan_utama           numeric(12, 4) not null default 0 check (bangunan_utama           >= 0),
  saluran_pembawa          numeric(12, 4) not null default 0 check (saluran_pembawa          >= 0),
  bangunan_saluran_pembawa numeric(12, 4) not null default 0 check (bangunan_saluran_pembawa >= 0),
  saluran_pembuang         numeric(12, 4) not null default 0 check (saluran_pembuang         >= 0),
  jalan_inspeksi           numeric(12, 4) not null default 0 check (jalan_inspeksi           >= 0),
  kantor_perumahan_gudang  numeric(12, 4) not null default 0 check (kantor_perumahan_gudang  >= 0)
);

-- --------------------------------------------------------------- pemicu
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger penilaian_updated_at
  before update on penilaian
  for each row execute function set_updated_at();
