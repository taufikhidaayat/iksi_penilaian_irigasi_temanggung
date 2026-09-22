-- =====================================================================
-- Salin seluruh penilaian satu periode ke periode berikutnya.
--
-- Kondisi jaringan jarang berubah banyak antar triwulan, sedangkan satu UPT
-- memegang sampai 175 D.I. yang masing-masing berisi 158 indikator. Mengetik
-- ulang semuanya tiap tiga bulan berarti mengerjakan ribuan isian yang
-- sebagian besar hasilnya sama persis dengan triwulan sebelumnya.
--
-- Dikerjakan di SQL, bukan dengan memanggil PostgREST satu per satu dari
-- server action: satu UPT bisa berarti puluhan ribu baris
-- `penilaian_aset_nilai` (D.I. terberat sendirian 5.197 baris). Lewat HTTP itu
-- ratusan permintaan berurutan, dan hampir pasti melewati batas waktu fungsi
-- serverless di tengah jalan, meninggalkan separuh periode tersalin.
--
-- SKOR TIDAK DIHITUNG ULANG DI SINI, dan itu disengaja. `total`,
-- `skor_komponen`, `jml_terisi`, dan `jml_indikator` disalin apa adanya
-- bersama seluruh nilai yang melahirkannya, jadi angkanya identik tanpa perlu
-- meniru mesin skoring TypeScript ke dalam SQL. Menirunya berarti punya dua
-- sumber kebenaran untuk angka yang sudah diverifikasi 0-mismatch terhadap
-- Excel, dan cepat atau lambat yang satu akan ketinggalan dari yang lain.
-- Begitu salinannya dibuka lalu diajukan, `simpanPenilaian` menghitung ulang
-- semuanya dari katalog seperti simpan biasa.
--
-- SECURITY INVOKER (bawaan), jadi seluruh RLS tetap berlaku: petugas UPT
-- hanya melihat penilaian wilayahnya sendiri sebagai bahan salinan, dan
-- kebijakan "buat penilaian" menolak baris di luar wilayahnya.
-- =====================================================================

create or replace function salin_penilaian_periode(
  p_tahun_sumber    smallint,
  p_triwulan_sumber periode_triwulan,
  p_tahun           smallint,
  p_triwulan        periode_triwulan,
  p_upt_id          smallint default null
)
returns table (disalin int, sudah_ada int, tanpa_sumber int)
language plpgsql
-- Salinan se-kabupaten menyentuh ratusan ribu baris dan bisa melewati
-- `statement_timeout` bawaan yang cuma beberapa detik. Kalau itu terjadi
-- seluruh transaksi dibatalkan, jadi tidak ada periode yang tersalin separuh,
-- tetapi petugas cuma melihat kegagalan tanpa sebab. Batasnya dilonggarkan di
-- sini saja, bukan untuk seluruh sesi.
set statement_timeout = '180s'
set search_path = public
as $$
declare
  r record;
  v_id uuid;
begin
  disalin := 0;
  sudah_ada := 0;

  if p_tahun_sumber = p_tahun and p_triwulan_sumber = p_triwulan then
    raise exception 'Periode sumber dan periode tujuan tidak boleh sama';
  end if;

  for r in
    select p.id, p.di_id, p.upt_id, p.kantong_lumpur, p.jumlah_p3a, p.jumlah_gp3a,
           p.total, p.skor_komponen, p.jml_terisi, p.jml_indikator
    from penilaian p
    where p.tahun = p_tahun_sumber
      and p.triwulan = p_triwulan_sumber
      and (p_upt_id is null or p.upt_id = p_upt_id)
      -- Penilaian kosong tidak punya apa pun untuk disalin; menyalinnya cuma
      -- menghasilkan draf kosong kedua yang menyamar sebagai pekerjaan.
      and coalesce(p.jml_terisi, 0) > 0
    order by p.di_id
  loop
    -- D.I. yang SUDAH punya penilaian di periode tujuan tidak pernah disentuh,
    -- apa pun statusnya. Karena itu tombolnya aman ditekan berulang kali, dan
    -- draf yang sedang dikerjakan petugas lain tidak ikut tertimpa.
    if exists (
      select 1 from penilaian t
      where t.di_id = r.di_id and t.tahun = p_tahun and t.triwulan = p_triwulan
    ) then
      sudah_ada := sudah_ada + 1;
      continue;
    end if;

    insert into penilaian (
      di_id, upt_id, tahun, triwulan, kantong_lumpur, status,
      jumlah_p3a, jumlah_gp3a, total, skor_komponen,
      jml_terisi, jml_indikator, dibuat_oleh
    )
    values (
      r.di_id, r.upt_id, p_tahun, p_triwulan, r.kantong_lumpur, 'draft',
      r.jumlah_p3a, r.jumlah_gp3a, r.total, r.skor_komponen,
      r.jml_terisi, r.jml_indikator, auth.uid()
    )
    returning id into v_id;

    insert into penilaian_nilai (penilaian_id, indikator_kode, nilai, keterangan)
    select v_id, n.indikator_kode, n.nilai, n.keterangan
    from penilaian_nilai n
    where n.penilaian_id = r.id;

    -- Nilai per bangunan disalin apa adanya, termasuk penanda `massal`.
    -- Bangunan yang sudah dihapus dari register tidak mungkin ikut terbawa:
    -- barisnya sudah lenyap dari periode sumber lewat `on delete cascade`.
    insert into penilaian_aset_nilai (penilaian_id, aset_id, indikator_kode, nilai, massal)
    select v_id, a.aset_id, a.indikator_kode, a.nilai, a.massal
    from penilaian_aset_nilai a
    where a.penilaian_id = r.id;

    insert into areal_terdampak (
      penilaian_id, bangunan_utama, saluran_pembawa, bangunan_saluran_pembawa,
      saluran_pembuang, jalan_inspeksi, kantor_perumahan_gudang
    )
    select v_id, x.bangunan_utama, x.saluran_pembawa, x.bangunan_saluran_pembawa,
           x.saluran_pembuang, x.jalan_inspeksi, x.kantor_perumahan_gudang
    from areal_terdampak x
    where x.penilaian_id = r.id;

    disalin := disalin + 1;
  end loop;

  -- Sisa pekerjaan yang tetap harus diisi tangan: D.I. yang tidak punya bahan
  -- salinan di periode sumber DAN belum punya penilaian di periode tujuan.
  -- Dilaporkan supaya petugas tahu tombol ini tidak menyelesaikan segalanya.
  select count(*) into tanpa_sumber
  from daerah_irigasi d
  where d.aktif
    and (p_upt_id is null or d.upt_id = p_upt_id)
    and not exists (
      select 1 from penilaian s
      where s.di_id = d.id
        and s.tahun = p_tahun_sumber
        and s.triwulan = p_triwulan_sumber
        and coalesce(s.jml_terisi, 0) > 0
    )
    and not exists (
      select 1 from penilaian t
      where t.di_id = d.id and t.tahun = p_tahun and t.triwulan = p_triwulan
    );

  return next;
end $$;

comment on function salin_penilaian_periode is
  'Menyalin seluruh isian satu periode ke periode lain sebagai draf baru. '
  'D.I. yang sudah punya penilaian di periode tujuan dilewati, tidak ditimpa. '
  'Skor disalin apa adanya karena inputnya identik, bukan dihitung ulang di SQL.';
