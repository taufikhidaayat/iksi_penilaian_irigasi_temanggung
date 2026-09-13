import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

/**
 * Klien service-role — MELEWATI seluruh Row Level Security.
 *
 * Hanya untuk operasi yang memang mustahil dilakukan pengguna biasa:
 * membuat akun auth, menonaktifkan akun, mengatur ulang kata sandi.
 * Impor `server-only` di atas membuat build gagal bila berkas ini pernah
 * tertarik ke bundel browser.
 *
 * Setiap pemanggil WAJIB memverifikasi sendiri bahwa penggunanya admin —
 * klien ini tidak punya pengaman bawaan.
 */
export function createAdminClient() {
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!kunci) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum diset. Tambahkan di .env.local (jangan diawali NEXT_PUBLIC_).",
    );
  }

  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, kunci, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
