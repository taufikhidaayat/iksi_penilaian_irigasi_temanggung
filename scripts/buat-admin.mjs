#!/usr/bin/env node
/**
 * Membuat akun Administrator pertama.
 *
 * Tanpa ini tidak ada seorang pun yang bisa masuk: pendaftaran mandiri sengaja
 * tidak disediakan, semua akun dibuat oleh Administrator.
 *
 * Pemakaian:
 *   node scripts/buat-admin.mjs "Nama Lengkap" username "KataSandiRahasia"
 *
 * Username-lah yang diketik saat masuk; email di Supabase Auth hanya identitas
 * internal yang diturunkan darinya (<username>@temanggungkab.go.id).
 *
 * Membutuhkan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.local
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

/** Pembaca .env sederhana — cukup untuk skrip sekali jalan. */
function muatEnv(berkas) {
  try {
    for (const baris of readFileSync(resolve(process.cwd(), berkas), "utf8").split("\n")) {
      const cocok = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!cocok) continue;
      const [, kunci, nilai] = cocok;
      if (!process.env[kunci]) {
        process.env[kunci] = nilai.replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // Berkas boleh tidak ada bila variabel sudah diekspor ke shell.
  }
}

muatEnv(".env.local");

const DOMAIN = "temanggungkab.go.id";
const POLA_USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/;

const [nama, usernameMentah, sandi] = process.argv.slice(2);

if (!nama || !usernameMentah || !sandi) {
  console.error('Pemakaian: node scripts/buat-admin.mjs "Nama Lengkap" username "KataSandi"');
  process.exit(1);
}

const username = usernameMentah.trim().toLowerCase();
if (!POLA_USERNAME.test(username)) {
  console.error(
    "Username hanya boleh huruf kecil, angka, titik, garis bawah, dan strip. Panjang 3-32 karakter.",
  );
  process.exit(1);
}

const email = `${username}@${DOMAIN}`;

if (sandi.length < 8) {
  console.error("Kata sandi minimal 8 karakter.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const kunciService = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !kunciService) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib ada di .env.local.\n" +
      "Ambil di Supabase → Project Settings → API.",
  );
  process.exit(1);
}

const supabase = createClient(url, kunciService, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password: sandi,
  email_confirm: true,
  // Trigger handle_new_user() membaca metadata ini untuk mengisi tabel profil.
  user_metadata: { nama, username, peran: "admin", upt_id: null },
});

if (error) {
  console.error(`Gagal: ${error.message}`);
  process.exit(1);
}

// Pastikan profil benar-benar terbentuk sebagai admin (jaga-jaga bila trigger
// belum terpasang saat migrasi dijalankan sebagian).
const { error: errProfil } = await supabase
  .from("profil")
  .upsert({ id: data.user.id, username, nama, peran: "admin", upt_id: null, aktif: true });

if (errProfil) {
  console.error(
    `Akun auth dibuat, tetapi profil gagal disimpan: ${errProfil.message}\n` +
      "Pastikan migrasi 0001 dan 0002 sudah dijalankan.",
  );
  process.exit(1);
}

console.log(`✓ Administrator dibuat. Username: ${username}`);
console.log("  Silakan masuk lalu segera ganti kata sandi.");
