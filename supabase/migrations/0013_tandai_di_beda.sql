-- =====================================================================
-- Menandai aset yang nama D.I.-nya di buku BERBEDA jauh dari nama D.I.
-- tempat aset itu tertaut di master.
--
-- Penautan aset ke Daerah Irigasi dikerjakan semata-mata lewat kode 4 digit
-- pada nomor aset (lihat migrasi 0007), TANPA pernah mencocokkan namanya.
-- Karena itu satu kode yang keliru di buku langsung memindahkan seluruh
-- bangunannya ke D.I. lain tanpa ada yang tahu — dan sejak penilaian
-- dikerjakan per bangunan, bangunan yang salah taut akan dinilai oleh UPT
-- yang salah, pada D.I. yang salah.
--
-- Contoh terbesar: 176 aset bertuliskan "DI SILUMUT KARANGTEJO" di buku
-- tertaut ke D.I. Aji Bangkong (33230001).
--
-- Migrasi ini TIDAK memindahkan apa pun. Memindahkan berarti menebak, dan
-- tebakan yang salah justru lebih berbahaya daripada data yang ditandai.
-- Yang dilakukan hanya memunculkannya sebagai daftar kerja di halaman Aset,
-- supaya petugas yang mengenal lapangan bisa memutuskan satu per satu.
--
-- Perbandingan nama memakai trigram similarity, bukan sama-persis, supaya
-- varian ejaan ("Pucung 2" lawan "Pucung II") tidak ikut tertandai. Nama
-- yang salah satunya memuat yang lain ("Sirancah Pakurejo" memuat "Sirancah")
-- juga dilewati.
--
-- Aman diulang: baris yang sudah bertanda karena alasan lain tidak disentuh,
-- dan baris yang sudah dirapikan petugas tidak ditandai ulang selama namanya
-- sudah cocok.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

/** Nama D.I. dibakukan: huruf besar, tanpa tanda baca, tanpa awalan "DI". */
create or replace function nama_di_baku(nama text)
returns text language sql immutable as $$
  select regexp_replace(
           upper(regexp_replace(coalesce(nama, ''), '[^A-Za-z0-9]', '', 'g')),
           '^DI', '')
$$;

comment on function nama_di_baku(text) is
  'Membakukan nama Daerah Irigasi untuk dibandingkan: "D.I. Sirandu" = "DI SIRANDU".';

do $$
declare
  ditandai int;
begin
  with beda as (
    select a.id
      from aset a
      join daerah_irigasi d on d.id = a.di_id
     where a.nama_di_buku is not null
       and nama_di_baku(a.nama_di_buku) <> nama_di_baku(d.nama)
       and position(nama_di_baku(d.nama) in nama_di_baku(a.nama_di_buku)) = 0
       and position(nama_di_baku(a.nama_di_buku) in nama_di_baku(d.nama)) = 0
       and extensions.similarity(nama_di_baku(a.nama_di_buku), nama_di_baku(d.nama)) < 0.4
  )
  update aset a
     set perlu_tinjau  = true,
         alasan_tinjau = 'nama D.I. di buku berbeda dari D.I. tautannya'
    from beda
   where beda.id = a.id
     -- Alasan yang sudah ada tidak ditimpa: nomor aset kosong atau kode D.I.
     -- tidak dikenal adalah temuan yang lebih mendasar dan harus tetap terbaca.
     and a.perlu_tinjau = false;

  get diagnostics ditandai = row_count;
  raise notice 'Aset bertanda "nama D.I. berbeda": % baris.', ditandai;
end $$;
