import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profil, Upt } from "@/lib/supabase/types";

export interface SesiPengguna {
  id: string;
  email: string | null;
  profil: Profil;
  upt: Upt | null;
  isAdmin: boolean;
}

/**
 * Ambil sesi + profil pengguna saat ini.
 * Middleware sudah menjaga rute, tetapi ini tetap memverifikasi ulang di server
 * agar halaman tidak pernah dirender dengan identitas yang tidak valid.
 */
export async function ambilSesi(): Promise<SesiPengguna> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/masuk");

  const { data: profil } = await supabase
    .from("profil")
    .select("*, upt(*)")
    .eq("id", user.id)
    .single<Profil & { upt: Upt | null }>();

  if (!profil || !profil.aktif) redirect("/masuk");

  const { upt, ...sisa } = profil;
  return {
    id: user.id,
    email: user.email ?? null,
    profil: sisa,
    upt,
    isAdmin: sisa.peran === "admin",
  };
}

/** Sama seperti ambilSesi, tetapi menolak pengguna non-admin. */
export async function ambilSesiAdmin(): Promise<SesiPengguna> {
  const sesi = await ambilSesi();
  if (!sesi.isAdmin) redirect("/");
  return sesi;
}
