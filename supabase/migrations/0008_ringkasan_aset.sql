-- =====================================================================
-- Ringkasan jumlah aset per jenis dan per UPT.
--
-- Tanpa ini, halaman Aset harus menembakkan 16 permintaan count terpisah
-- (satu per jenis) hanya untuk menampilkan kartu ringkasan. Satu view yang
-- di-GROUP BY di Postgres jauh lebih murah dan hanya butuh sekali jalan.
-- =====================================================================

create view ringkasan_aset
with (security_invoker = true)
as
select
  a.jenis,
  d.upt_id,
  count(*)::int                                        as jumlah,
  count(*) filter (where a.perlu_tinjau)::int          as perlu_tinjau,
  count(*) filter (where a.di_id is null)::int         as tanpa_di
from aset a
left join daerah_irigasi d on d.id = a.di_id
group by a.jenis, d.upt_id;

comment on view ringkasan_aset is
  'Jumlah aset per jenis per UPT. security_invoker: RLS pemanggil tetap berlaku.';
