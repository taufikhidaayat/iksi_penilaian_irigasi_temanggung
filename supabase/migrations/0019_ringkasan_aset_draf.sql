-- =====================================================================
-- Ringkasan draf per jenis, sejalan dengan `ringkasan_aset` (migrasi 0018).
--
-- Kartu di menu Aset Draf hanya menyebut jumlah baris, sehingga menimbulkan
-- kebingungan yang sama persis seperti di menu Aset Irigasi: nomor D.I. cuma
-- sampai 577, tetapi kartu Bendung Baru menampilkan 584, tanpa ada penjelasan
-- apa pun di layar. Selisihnya nyata (7 di antaranya bendung suplesi), namun
-- tidak ada yang bisa menyimpulkan itu dari kartunya saja.
--
-- View ini menyediakan angka yang sama bentuknya dengan `ringkasan_aset`,
-- supaya kedua menu berbicara dengan satuan yang sama:
--
--   jumlah       jumlah baris di tabel
--   jumlah_aset  identitas yang berbeda
--   jumlah_di    berapa D.I. yang diwakili
--   tanpa_di     baris yang belum tertaut D.I.
--
-- `jumlah_aset` saat ini selalu sama dengan `jumlah`: tidak satu pun dari 8
-- berkas draf memuat baris yang isinya persis kembar. Kolomnya tetap
-- disediakan supaya kartu draf dan kartu aset memakai perhitungan yang sama,
-- dan supaya berkas draf berikutnya yang ternyata memuat baris ganda langsung
-- ketahuan tanpa perlu mengubah apa pun lagi.
--
-- Identitas satu baris draf adalah seluruh isi `data`. Berbeda dari tabel
-- `aset` yang kolomnya tetap, susunan kolom draf berbeda-beda tiap jenis,
-- jadi tidak ada sekumpulan kolom identitas yang bisa ditulis tetap di sini.
-- =====================================================================

create view ringkasan_aset_draf
with (security_invoker = true)
as
select
  b.jenis,
  count(a.id)::int                                     as jumlah,
  count(distinct a.data::text)::int                    as jumlah_aset,
  count(distinct a.di_id)::int                         as jumlah_di,
  count(*) filter (where a.di_id is null)::int         as tanpa_di
from aset_draf_berkas b
left join aset_draf a on a.jenis = b.jenis
group by b.jenis;

comment on view ringkasan_aset_draf is
  'Jumlah baris, aset, dan D.I. per jenis draf. Sejalan dengan ringkasan_aset. '
  'security_invoker: RLS pemanggil tetap berlaku, jadi tetap khusus admin.';
