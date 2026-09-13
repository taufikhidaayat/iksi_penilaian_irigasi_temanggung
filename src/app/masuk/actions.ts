"use server";

import { redirect } from "next/navigation";

import { z } from "zod";

import { PESAN_USERNAME, POLA_USERNAME, emailDariUsername, normalkanUsername } from "@/lib/akun";
import { denganNotif } from "@/lib/notif";
import { createClient } from "@/lib/supabase/server";

const SkemaMasuk = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Username wajib diisi.")
    .transform(normalkanUsername)
    .refine((v) => POLA_USERNAME.test(v), PESAN_USERNAME),
  sandi: z.string().min(1, "Kata sandi wajib diisi."),
  // `nullish`, bukan `optional`: input tersembunyi "lanjut" hanya dirender bila
  // ada tujuan, dan formData.get() mengembalikan null — bukan undefined — untuk
  // field yang tidak ada. `optional()` menolak null, sehingga seluruh form gagal
  // divalidasi padahal username dan sandi sudah benar.
  lanjut: z.string().nullish(),
});

export interface StatusMasuk {
  error?: string;
  bidang?: Partial<Record<"username" | "sandi", string>>;
}

export async function masuk(_sebelum: StatusMasuk, formData: FormData): Promise<StatusMasuk> {
  const hasil = SkemaMasuk.safeParse({
    username: formData.get("username"),
    sandi: formData.get("sandi"),
    lanjut: formData.get("lanjut"),
  });

  if (!hasil.success) {
    const bidang: StatusMasuk["bidang"] = {};
    for (const isu of hasil.error.issues) {
      const nama = isu.path[0];
      if (nama === "username" || nama === "sandi") bidang[nama] ??= isu.message;
    }
    // Bila galatnya bukan pada field yang punya tempat tampil, form akan tampak
    // "tidak melakukan apa-apa" saat ditekan. Selalu sisakan pesan umum.
    if (Object.keys(bidang).length === 0) {
      return { error: "Data tidak valid. Muat ulang halaman lalu coba lagi." };
    }
    return { bidang };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    // Email hanyalah identitas internal yang diturunkan dari username.
    email: emailDariUsername(hasil.data.username),
    password: hasil.data.sandi,
  });

  if (error) {
    // Pesan sengaja tidak membedakan "username tidak ada" dari "sandi salah",
    // supaya daftar username tidak bisa ditebak dari luar.
    return {
      error:
        error.message === "Invalid login credentials"
          ? "Username atau kata sandi salah."
          : "Gagal masuk. Coba beberapa saat lagi.",
    };
  }

  const tujuan = hasil.data.lanjut;
  // Hanya izinkan path internal, cegah open redirect.
  const aman = tujuan && tujuan.startsWith("/") && !tujuan.startsWith("//") ? tujuan : "/";
  redirect(denganNotif(aman, "masuk"));
}

export async function keluar() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(denganNotif("/masuk", "keluar"));
}
