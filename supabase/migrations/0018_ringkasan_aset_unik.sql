-- =====================================================================
-- Ringkasan aset: pisahkan "jumlah aset" dari "jumlah baris".
--
-- Kartu Rincian per Jenis selama ini menampilkan `count(*)`, yaitu jumlah
-- BARIS. Dua hal membuat angka itu bisa menyesatkan petugas:
--
--   1. Lima baris di tabel `aset` identik seluruh identitasnya (nomenklatur,
--      nama, nomor, D.I., desa, kecamatan). Baris seperti itu hampir pasti
--      salah input ganda, tetapi tetap ikut terhitung sebagai aset tersendiri.
--
--   2. Tidak ada konteks berapa D.I. yang diwakili. Petugas yang terbiasa
--      dengan kerangka "577 D.I." melihat 592 bendung dan menyangka ada yang
--      salah hitung, padahal selisihnya memang nyata: 577 bendung utama,
--      7 bendung suplesi, dan 8 bendung buku yang belum tertaut D.I.
--
-- Karena itu view ini kini menyediakan tiga angka sekaligus. Yang ditonjolkan
-- di layar adalah `jumlah_aset`; `jumlah` (baris) turun jadi keterangan kecil
-- dan hanya ditampilkan ketika berbeda, sehingga selisihnya justru terbaca
-- sebagai penanda data yang perlu dirapikan, bukan tersembunyi.
--
-- `jumlah` DIPERTAHANKAN apa adanya supaya angka kartu tetap bisa disandingkan
-- dengan jumlah baris pada daftar di bawahnya. Kartu yang menyebut 673
-- sementara daftarnya memuat 675 baris, tanpa keterangan apa pun, adalah
-- kebingungan yang lain lagi.
--
-- Identitas sengaja dirangkai jadi teks, bukan memakai `count(distinct (a, b,
-- …))` atas row constructor: NULL pada salah satu kolom membuat perbandingan
-- row berperilaku tidak seperti yang diduga, sedangkan coalesce ke string
-- kosong bersifat deterministik dan sama persis dengan `penandaKembar()` di
-- src/lib/aset.ts.
-- =====================================================================

create or replace view ringkasan_aset
with (security_invoker = true)
as
select
  a.jenis,
  d.upt_id,
  count(*)::int                                        as jumlah,
  count(*) filter (where a.perlu_tinjau)::int          as perlu_tinjau,
  count(*) filter (where a.di_id is null)::int         as tanpa_di,
  count(distinct concat_ws(
    '|',
    coalesce(a.nomenklatur, ''),
    a.nama,
    coalesce(a.kode, ''),
    coalesce(a.di_id::text, ''),
    coalesce(a.desa, ''),
    coalesce(a.kecamatan, '')
  ))::int                                              as jumlah_aset,
  count(distinct a.di_id)::int                         as jumlah_di
from aset a
left join daerah_irigasi d on d.id = a.di_id
group by a.jenis, d.upt_id;

comment on view ringkasan_aset is
  'Jumlah aset per jenis per UPT. jumlah = baris, jumlah_aset = identitas '
  'berbeda, jumlah_di = D.I. yang diwakili. security_invoker: RLS pemanggil '
  'tetap berlaku.';
