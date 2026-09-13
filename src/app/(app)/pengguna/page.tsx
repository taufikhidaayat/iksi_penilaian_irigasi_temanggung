import { KepalaHalaman } from "@/components/layout/kepala-halaman";
import { ambilSesiAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { type BarisPengguna, KelolaPengguna } from "./kelola-pengguna";

export default async function HalamanPengguna() {
  const sesi = await ambilSesiAdmin();
  const supabase = await createClient();

  const [{ data: profil }, { data: daftarUpt }] = await Promise.all([
    supabase
      .from("profil")
      .select("id, username, nama, peran, upt_id, aktif, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("upt").select("id, nama").order("urutan"),
  ]);

  const uptMap = new Map((daftarUpt ?? []).map((u) => [u.id, u.nama]));

  const daftar: BarisPengguna[] = (profil ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    nama: p.nama,
    peran: p.peran,
    uptNama: p.upt_id ? (uptMap.get(p.upt_id) ?? null) : null,
    aktif: p.aktif,
    dibuat: p.created_at,
  }));

  return (
    <>
      <KepalaHalaman
        judul="Pengguna"
        deskripsi="Kelola akun Administrator dan petugas UPT. Akun menentukan wilayah data yang bisa diakses."
      />
      <KelolaPengguna daftar={daftar} daftarUpt={daftarUpt ?? []} idSaya={sesi.id} />
    </>
  );
}
