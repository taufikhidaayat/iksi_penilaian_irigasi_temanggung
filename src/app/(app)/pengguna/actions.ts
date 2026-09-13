"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import {
  PESAN_USERNAME,
  POLA_USERNAME,
  emailDariUsername,
  normalkanUsername,
} from "@/lib/akun";
import { ambilSesiAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface HasilPengguna {
  ok: boolean;
  pesan?: string;
}

const SkemaBuat = z
  .object({
    nama: z.string().trim().min(3, "Nama minimal 3 karakter.").max(120),
    username: z
      .string()
      .trim()
      .min(1, "Username wajib diisi.")
      .transform(normalkanUsername)
      .refine((v) => POLA_USERNAME.test(v), PESAN_USERNAME),
    sandi: z.string().min(8, "Kata sandi minimal 8 karakter.").max(72),
    peran: z.enum(["admin", "upt"]),
    uptId: z.string().optional(),
  })
  .refine((v) => v.peran === "admin" || Boolean(v.uptId), {
    message: "Akun UPT wajib dipilihkan UPT-nya.",
    path: ["uptId"],
  });

export async function buatPengguna(
  _prev: HasilPengguna,
  formData: FormData,
): Promise<HasilPengguna> {
  await ambilSesiAdmin();

  const parsed = SkemaBuat.safeParse({
    nama: formData.get("nama"),
    username: formData.get("username"),
    sandi: formData.get("sandi"),
    peran: formData.get("peran"),
    uptId: formData.get("uptId") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, pesan: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const { nama, username, sandi, peran, uptId } = parsed.data;
  const admin = createAdminClient();

  // Trigger handle_new_user() membaca metadata ini untuk mengisi tabel profil.
  const { error } = await admin.auth.admin.createUser({
    email: emailDariUsername(username),
    password: sandi,
    email_confirm: true,
    user_metadata: {
      nama,
      username,
      peran,
      upt_id: peran === "upt" ? Number(uptId) : null,
    },
  });

  if (error) {
    return {
      ok: false,
      pesan: error.message.includes("already been registered")
        ? `Username "${username}" sudah dipakai.`
        : `Gagal membuat akun: ${error.message}`,
    };
  }

  revalidatePath("/pengguna");
  return { ok: true };
}

export async function ubahAktif(id: string, aktif: boolean): Promise<HasilPengguna> {
  const sesi = await ambilSesiAdmin();
  if (id === sesi.id) {
    return { ok: false, pesan: "Tidak bisa menonaktifkan akun Anda sendiri." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profil").update({ aktif }).eq("id", id);
  if (error) return { ok: false, pesan: "Gagal memperbarui status akun." };

  revalidatePath("/pengguna");
  return { ok: true };
}

const SkemaSandi = z.object({
  id: z.string().uuid(),
  sandi: z.string().min(8, "Kata sandi minimal 8 karakter.").max(72),
});

export async function aturUlangSandi(id: string, sandi: string): Promise<HasilPengguna> {
  await ambilSesiAdmin();

  const parsed = SkemaSandi.safeParse({ id, sandi });
  if (!parsed.success) {
    return { ok: false, pesan: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password: sandi });
  if (error) return { ok: false, pesan: `Gagal mengganti kata sandi: ${error.message}` };

  return { ok: true };
}
