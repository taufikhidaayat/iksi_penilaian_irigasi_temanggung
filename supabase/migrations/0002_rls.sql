-- =====================================================================
-- Row Level Security
--   admin : akses penuh seluruh UPT
--   upt   : hanya baris milik UPT-nya, dan hanya bisa mengubah
--           penilaian yang berstatus 'draft' atau 'revisi'
-- =====================================================================

-- Pembantu. SECURITY DEFINER agar pembacaan `profil` di dalamnya tidak
-- ikut dievaluasi RLS `profil` (yang akan menyebabkan rekursi tak hingga).
create or replace function auth_peran() returns peran_pengguna
language sql stable security definer set search_path = public as $$
  select peran from profil where id = auth.uid() and aktif
$$;

create or replace function auth_upt_id() returns smallint
language sql stable security definer set search_path = public as $$
  select upt_id from profil where id = auth.uid() and aktif
$$;

create or replace function is_admin() returns boolean
language sql stable as $$ select auth_peran() = 'admin' $$;

/** UPT yang boleh diakses pengguna saat ini: admin -> semua. */
create or replace function boleh_akses_upt(target smallint) returns boolean
language sql stable as $$ select is_admin() or auth_upt_id() = target $$;

alter table upt              enable row level security;
alter table profil           enable row level security;
alter table daerah_irigasi   enable row level security;
alter table indikator        enable row level security;
alter table penilaian        enable row level security;
alter table penilaian_nilai  enable row level security;
alter table areal_terdampak  enable row level security;

-- ------------------------------------------------- referensi (baca saja)
create policy "baca upt" on upt
  for select to authenticated using (true);

create policy "baca indikator" on indikator
  for select to authenticated using (true);

create policy "kelola indikator" on indikator
  for all to authenticated using (is_admin()) with check (is_admin());

-- --------------------------------------------------------------- profil
create policy "baca profil sendiri" on profil
  for select to authenticated using (id = auth.uid() or is_admin());

create policy "ubah profil sendiri" on profil
  for update to authenticated
  using (id = auth.uid() or is_admin())
  -- Pengguna biasa tidak boleh menaikkan peran atau pindah UPT sendiri.
  with check (
    is_admin() or (
      id = auth.uid()
      and peran  = (select p.peran  from profil p where p.id = auth.uid())
      and upt_id is not distinct from (select p.upt_id from profil p where p.id = auth.uid())
    )
  );

create policy "admin kelola profil" on profil
  for all to authenticated using (is_admin()) with check (is_admin());

-- ------------------------------------------------------- daerah irigasi
-- Sengaja bisa dibaca semua UPT: rekap kabupaten perlu nama & luas D.I.
create policy "baca daerah irigasi" on daerah_irigasi
  for select to authenticated using (true);

create policy "admin kelola daerah irigasi" on daerah_irigasi
  for all to authenticated using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------ penilaian
create policy "baca penilaian" on penilaian
  for select to authenticated using (boleh_akses_upt(upt_id));

create policy "buat penilaian" on penilaian
  for insert to authenticated
  with check (
    boleh_akses_upt(upt_id)
    -- D.I. yang dinilai harus benar-benar milik UPT tersebut.
    and exists (select 1 from daerah_irigasi d where d.id = di_id and d.upt_id = penilaian.upt_id)
  );

create policy "ubah penilaian" on penilaian
  for update to authenticated
  using (
    boleh_akses_upt(upt_id)
    and (is_admin() or status in ('draft', 'revisi'))
  )
  with check (boleh_akses_upt(upt_id));

create policy "hapus penilaian" on penilaian
  for delete to authenticated
  using (is_admin() or (boleh_akses_upt(upt_id) and status = 'draft'));

-- ------------------------------------------------------ nilai indikator
create or replace function penilaian_bisa_ditulis(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from penilaian p
    where p.id = p_id
      and boleh_akses_upt(p.upt_id)
      and (is_admin() or p.status in ('draft', 'revisi'))
  )
$$;

create or replace function penilaian_bisa_dibaca(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from penilaian p where p.id = p_id and boleh_akses_upt(p.upt_id)
  )
$$;

create policy "baca nilai" on penilaian_nilai
  for select to authenticated using (penilaian_bisa_dibaca(penilaian_id));

create policy "tulis nilai" on penilaian_nilai
  for all to authenticated
  using (penilaian_bisa_ditulis(penilaian_id))
  with check (penilaian_bisa_ditulis(penilaian_id));

-- ------------------------------------------------------ areal terdampak
create policy "baca areal" on areal_terdampak
  for select to authenticated using (penilaian_bisa_dibaca(penilaian_id));

create policy "tulis areal" on areal_terdampak
  for all to authenticated
  using (penilaian_bisa_ditulis(penilaian_id))
  with check (penilaian_bisa_ditulis(penilaian_id));

-- --------------------------------------------- profil otomatis saat daftar
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profil (id, nama, peran, upt_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nama', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'peran')::peran_pengguna, 'upt'),
    (new.raw_user_meta_data ->> 'upt_id')::smallint
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
