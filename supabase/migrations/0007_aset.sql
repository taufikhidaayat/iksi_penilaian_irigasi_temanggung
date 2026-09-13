-- =====================================================================
-- Aset Irigasi — Permen PUPR 23/PRT/M/2015 (Pengelolaan Aset Irigasi)
--
-- Sumber awal: "BUKU ASET IRIGASI WORD 2026.docx" (11.611 baris).
-- Terhubung ke daerah_irigasi lewat kode 4 digit pada segmen ke-4 nomor aset:
--     33.23.010306.[0538].01001.2002  ->  D.I. kode 3323[0538]
--
-- CATATAN PENTING soal keunikan:
--   `kode` SENGAJA tidak unik. Pada buku sumber, 1.033 kode dipakai berulang —
--   mis. tiga bendung D.I. Ngasalan sama-sama bernomor ...0011.01001.2002
--   padahal nomenklatur dan desanya berbeda. Memaksakan unique constraint akan
--   membuang data yang sah. Baris seperti itu ditandai `perlu_tinjau` agar
--   muncul sebagai daftar kerja untuk dirapikan lewat aplikasi.
-- =====================================================================

create type jenis_aset as enum (
  -- Bangunan (BAB III)
  'bendung',
  'saluran',
  'sadap',
  'saluran_pelimpah',
  'terjunan',
  'talang',
  'gorong_gorong',
  'tanah_saluran',
  'bangunan_pengaman',
  -- Tanah (BAB IV)
  'tanah_rumah',
  'tanah_bangunan_saluran',
  'tanah_saluran_ma',
  'tanah_lambiran_sungai',
  'tanah_lambiran_saluran',
  'tanah_tidak_tersedia_kib',
  'jalan_inspeksi'
);

create table aset (
  id            bigint generated always as identity primary key,

  jenis         jenis_aset not null,
  /** Nama yang dikenal di lapangan, mis. "BNDG.0517". Kosong untuk aset tanah. */
  nomenklatur   text,
  /** Nama/jenis aset, mis. "Bendung Tetap", "Saluran Sekunder". */
  nama          text not null,
  /** Nomor aset spasial lengkap. Boleh kosong: 144 baris di buku belum bernomor. */
  kode          text,

  di_id         bigint references daerah_irigasi (id) on delete restrict,
  /** Kode D.I. 4 digit apa adanya dari buku, termasuk yang tidak dikenali. */
  kode_di_buku  text,
  /** Nama D.I. sebagaimana tertulis di buku, untuk penelusuran bila di_id kosong. */
  nama_di_buku  text,

  desa          text,
  kecamatan     text,
  /** Khusus saluran: bangunan di hulu dan hilirnya. */
  bangunan_hulu  text,
  bangunan_hilir text,
  tahun         smallint,

  /** Nomor seksi pada buku sumber, mis. "3.1". */
  seksi_buku    text,
  /** Ditandai bila datanya meragukan; jadi daftar kerja perapian. */
  perlu_tinjau  boolean not null default false,
  alasan_tinjau text,

  catatan       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on aset (di_id);
create index on aset (jenis);
create index on aset (kode);
create index on aset (nomenklatur);
create index on aset (perlu_tinjau) where perlu_tinjau;
create index aset_cari_idx on aset
  using gin (to_tsvector('simple', coalesce(nomenklatur, '') || ' ' || nama || ' ' || coalesce(kode, '')));

create trigger aset_updated_at
  before update on aset
  for each row execute function set_updated_at();

comment on column aset.kode is
  'Nomor aset spasial. TIDAK unik — buku sumber memuat kode berulang.';

-- ------------------------------------------------------------------ RLS
alter table aset enable row level security;

-- Semua petugas boleh membaca: rekap kabupaten dan konteks penilaian
-- membutuhkan daftar aset lintas UPT.
create policy "baca aset" on aset
  for select to authenticated using (true);

create policy "admin kelola aset" on aset
  for all to authenticated using (is_admin()) with check (is_admin());

-- UPT boleh merapikan aset di wilayahnya sendiri.
create policy "upt ubah aset wilayahnya" on aset
  for update to authenticated
  using (
    exists (
      select 1 from daerah_irigasi d
      where d.id = aset.di_id and boleh_akses_upt(d.upt_id)
    )
  )
  with check (
    exists (
      select 1 from daerah_irigasi d
      where d.id = aset.di_id and boleh_akses_upt(d.upt_id)
    )
  );

create policy "upt tambah aset wilayahnya" on aset
  for insert to authenticated
  with check (
    exists (
      select 1 from daerah_irigasi d
      where d.id = aset.di_id and boleh_akses_upt(d.upt_id)
    )
  );
