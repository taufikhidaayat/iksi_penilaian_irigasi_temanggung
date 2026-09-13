-- =====================================================================
-- Login dengan username, bukan email.
--
-- Supabase Auth tetap menyimpan email (wajib untuk sandi), tetapi email itu
-- kini sekadar identitas internal yang diturunkan dari username:
--     <username>@temanggungkab.go.id
-- Pengguna tidak pernah melihat atau mengetiknya.
--
-- Kolom `username` di sini dipakai untuk menampilkan identitas di halaman
-- Pengguna dan menjamin keunikannya di sisi database.
-- =====================================================================

alter table profil add column if not exists username text;

-- Isi dari bagian sebelum "@" pada email akun yang sudah ada.
update profil p
   set username = lower(split_part(u.email, '@', 1))
  from auth.users u
 where u.id = p.id
   and p.username is null;

alter table profil alter column username set not null;

-- Unik tanpa memandang huruf besar/kecil.
create unique index if not exists profil_username_unik on profil (lower(username));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profil_username_format'
  ) then
    alter table profil add constraint profil_username_format
      check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');
  end if;
end $$;

comment on column profil.username is
  'Identitas yang diketik saat masuk. Email di auth.users diturunkan darinya.';

-- Trigger ikut mengisi username saat akun dibuat.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profil (id, nama, peran, upt_id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nama', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'peran')::peran_pengguna, 'upt'),
    (new.raw_user_meta_data ->> 'upt_id')::smallint,
    lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)))
  );
  return new;
end $$;
