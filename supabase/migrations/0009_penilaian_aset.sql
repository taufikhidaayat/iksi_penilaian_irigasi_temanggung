-- =====================================================================
-- Penilaian per bangunan (Komponen I Prasarana Fisik)
--
-- Blangko Permen PUPR 12/PRT/M/2015 memeriksa tiap bangunan satu per satu,
-- lalu merekapnya. D.I. dengan 41 bangunan sadap berarti 41 baris pemeriksaan,
-- bukan satu. Tabel ini menampung baris-baris itu.
--
-- Hasil rata-ratanya TETAP ditulis ke `penilaian_nilai` seperti sebelumnya,
-- sehingga mesin skoring, rekap, dan ekspor tidak berubah sama sekali.
-- Alasannya: rata-rata itu operasi linear, jadi merata-ratakan per indikator
-- menghasilkan angka yang identik dengan cara blangko (hitung nilai tiap
-- bangunan dulu, baru dirata-rata).
--
--     rata-rata( Σ bobotᵢ × nilaiᵢⱼ )  =  Σ bobotᵢ × rata-rata( nilaiᵢⱼ )
--          j                                              j
--
-- Lihat RENCANA-PENILAIAN-PER-BANGUNAN.md untuk pemetaan jenis aset ke
-- kelompok indikator, dan alasan 91 dari 158 indikator tetap dinilai agregat.
-- =====================================================================

-- ---------------------------------------------------- pelebaran penilaian_nilai
-- Nilai indikator yang dinilai per bangunan adalah RATA-RATA, jadi hampir
-- selalu pecahan: 41 sadap dengan nilai beragam menghasilkan mis. 83,415.
--
-- Kolomnya semula `smallint`. Membulatkannya akan membuat baris di sini tidak
-- lagi cocok dengan `penilaian.total` yang dibekukan (total dihitung dari angka
-- penuh sebelum disimpan), sehingga siapa pun yang menghitung ulang dari tabel
-- ini akan mendapat angka berbeda dari yang tampil di rekap. Pelebaran ke
-- numeric menghapus jebakan itu.
--
-- Aman untuk data yang sudah ada: smallint -> numeric tidak memotong apa pun,
-- dan batas 0..100 tetap berlaku.
alter table penilaian_nilai
  alter column nilai type numeric(6, 3) using nilai::numeric;

comment on column penilaian_nilai.nilai is
  'Nilai 0..100. Pecahan untuk indikator yang dirata-rata dari banyak bangunan.';

create table penilaian_aset_nilai (
  penilaian_id   uuid     not null references penilaian (id) on delete cascade,
  aset_id        bigint   not null references aset (id)      on delete cascade,
  indikator_kode text     not null references indikator (kode) on delete restrict,
  nilai          smallint not null check (nilai between 0 and 100),

  /**
   * Dibedakan antara nilai yang diisi satu per satu dan nilai yang datang dari
   * pengisian massal. Tanpa penanda ini, D.I. yang seluruh bangunannya diisi
   * sekali klik tidak bisa dibedakan dari yang diperiksa sungguhan, dan
   * verifikator kehilangan dasar untuk menilai kelayakan pengajuan.
   */
  massal         boolean  not null default false,

  primary key (penilaian_id, aset_id, indikator_kode)
);

-- Merata-ratakan satu indikator lintas seluruh aset pada satu penilaian
-- adalah query terpanas di modul ini; indeks ini yang melayaninya.
create index on penilaian_aset_nilai (penilaian_id, indikator_kode);

comment on table penilaian_aset_nilai is
  'Nilai kondisi per bangunan. Rata-ratanya disalin ke penilaian_nilai saat simpan.';
comment on column penilaian_aset_nilai.massal is
  'true bila nilai berasal dari pengisian massal, bukan pemeriksaan satu per satu.';

-- ------------------------------------------------------------------ RLS
-- Mengikuti pola `penilaian_nilai`: kelayakan ditentukan oleh penilaian
-- induknya, lewat fungsi yang sudah ada di 0002_rls.sql.
alter table penilaian_aset_nilai enable row level security;

create policy "baca nilai aset" on penilaian_aset_nilai
  for select to authenticated using (penilaian_bisa_dibaca(penilaian_id));

create policy "tulis nilai aset" on penilaian_aset_nilai
  for all to authenticated
  using (penilaian_bisa_ditulis(penilaian_id))
  with check (penilaian_bisa_ditulis(penilaian_id));
