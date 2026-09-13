-- =====================================================================
-- Mengganti label periode dari singkatan "TW" menjadi "Triwulan".
--
-- ALTER TYPE ... RENAME VALUE mengubah label enum di tempat, sehingga baris
-- penilaian yang sudah ada ikut terbawa tanpa perlu disalin atau di-cast.
-- =====================================================================

do $$
begin
  if exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'periode_triwulan' and e.enumlabel = 'TW I'
  ) then
    alter type periode_triwulan rename value 'TW I'   to 'Triwulan I';
    alter type periode_triwulan rename value 'TW II'  to 'Triwulan II';
    alter type periode_triwulan rename value 'TW III' to 'Triwulan III';
    alter type periode_triwulan rename value 'TW IV'  to 'Triwulan IV';
  end if;
end $$;
