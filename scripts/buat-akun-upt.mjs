#!/usr/bin/env node
/**
 * Memastikan tiap UPT Regional punya satu akun petugas.
 *
 * Username diturunkan dari nama regional:
 *     "Regional III - Ngadirejo" -> `upt.ngadirejo`
 * Akun yang masih memakai bentuk lama (tanpa awalan `upt.`) ikut dipindahkan,
 * lengkap dengan email internalnya — jadi skrip ini aman diulang.
 *
 * Ditujukan untuk pengembangan / uji coba: semua akun memakai kata sandi yang
 * sama supaya mudah dicoba. Untuk pemakaian sungguhan, buat akun per petugas
 * lewat menu Pengguna dan beri kata sandi masing-masing.
 *
 * Pemakaian:
 *   node scripts/buat-akun-upt.mjs                 # sandi bawaan
 *   node scripts/buat-akun-upt.mjs "SandiLain#1"   # sandi sendiri
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

function muatEnv(berkas) {
  try {
    for (const baris of readFileSync(resolve(process.cwd(), berkas), "utf8").split("\n")) {
      const cocok = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!cocok) continue;
      const [, k, v] = cocok;
      if (!process.env[k]) process.env[k] = v.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* boleh tidak ada */
  }
}

muatEnv(".env.local");

const SANDI = process.argv[2] ?? "UptIksi#2026";
const DOMAIN = "temanggungkab.go.id";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib ada di .env.local.");
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: daftarUpt, error: eUpt } = await admin.from("upt").select("id, nama").order("urutan");
if (eUpt || !daftarUpt?.length) {
  console.error(`Gagal membaca daftar UPT: ${eUpt?.message ?? "kosong"}`);
  console.error("Jalankan dulu: npm run db:migrasi");
  process.exit(1);
}

/** "Regional III - Ngadirejo" -> "ngadirejo" (tanpa awalan) */
function slugUpt(nama) {
  return nama
    .split("-")
    .pop()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Username yang dipakai masuk, mis. "upt.ngadirejo". */
function usernameUpt(nama) {
  return `upt.${slugUpt(nama)}`;
}

/** Cari pengguna auth berdasarkan email, menelusuri seluruh halaman. */
async function cariAuth(email) {
  for (let halaman = 1; halaman <= 20; halaman++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: halaman, perPage: 200 });
    if (error) throw new Error(error.message);
    const ketemu = data.users.find((u) => u.email?.toLowerCase() === email);
    if (ketemu) return ketemu;
    if (data.users.length < 200) return null;
  }
  return null;
}

console.log(`\nMenyiapkan ${daftarUpt.length} akun UPT (sandi: ${SANDI})\n`);

const hasil = [];
for (const upt of daftarUpt) {
  const username = usernameUpt(upt.nama);
  const email = `${username}@${DOMAIN}`;
  // Bentuk lama yang pernah dipakai: tanpa awalan "upt.".
  const emailLama = `${slugUpt(upt.nama)}@${DOMAIN}`;

  const sudahAda = await cariAuth(email);
  const versiLama = sudahAda ? null : await cariAuth(emailLama);

  if (versiLama) {
    // Pindahkan akun lama: email internal dan username ikut disesuaikan.
    const { error } = await admin.auth.admin.updateUserById(versiLama.id, {
      email,
      email_confirm: true,
      user_metadata: { ...versiLama.user_metadata, username },
    });
    if (error) {
      console.log(`  ✗ ${username.padEnd(16)} gagal dipindahkan: ${error.message}`);
      continue;
    }
    await admin.from("profil").update({ username }).eq("id", versiLama.id);
    console.log(`  ↻ ${username.padEnd(16)} dipindahkan dari "${slugUpt(upt.nama)}"`);
    hasil.push({ username, upt: upt.nama });
    continue;
  }

  if (sudahAda) {
    await admin.from("profil").update({ username }).eq("id", sudahAda.id);
    console.log(`  – ${username.padEnd(16)} sudah ada`);
    hasil.push({ username, upt: upt.nama });
    continue;
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password: SANDI,
    email_confirm: true,
    user_metadata: { nama: `Petugas ${upt.nama}`, username, peran: "upt", upt_id: upt.id },
  });
  if (error) {
    console.log(`  ✗ ${username.padEnd(16)} ${error.message}`);
    continue;
  }
  console.log(`  ✓ ${username.padEnd(16)} ${upt.nama}`);
  hasil.push({ username, upt: upt.nama });
}

console.log("\nRingkasan akun:\n");
console.log("  " + "Username".padEnd(18) + "UPT");
console.log("  " + "-".repeat(16) + "  " + "-".repeat(28));
for (const h of hasil) console.log(`  ${h.username.padEnd(18)}${h.upt}`);
console.log(`\n  Kata sandi semua akun: ${SANDI}`);
console.log("  Ganti lewat menu Pengguna sebelum dipakai sungguhan.\n");
