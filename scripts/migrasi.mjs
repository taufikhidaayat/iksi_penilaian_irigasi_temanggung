#!/usr/bin/env node
/**
 * Menjalankan berkas SQL di supabase/migrations/ secara berurutan, sekali saja.
 *
 * Berkas yang sudah pernah dijalankan dicatat di tabel `_migrasi`, sehingga
 * perintah ini aman diulang: hanya migrasi baru yang dieksekusi. Tiap berkas
 * dibungkus transaksi — bila gagal di tengah, seluruh perubahannya dibatalkan
 * dan tidak ikut tercatat.
 *
 * Memakai DIRECT_URL (pooler mode session, port 5432) karena DDL tidak bisa
 * lewat pooler mode transaction (port 6543).
 *
 * Pemakaian:
 *   node scripts/migrasi.mjs                    # jalankan yang belum pernah
 *   node scripts/migrasi.mjs --cek              # uji koneksi + status saja
 *   node scripts/migrasi.mjs --tandai 0001.sql  # catat sebagai sudah, tanpa jalan
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

function muatEnv(berkas) {
  try {
    for (const baris of readFileSync(resolve(process.cwd(), berkas), "utf8").split("\n")) {
      const cocok = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!cocok) continue;
      const [, kunci, nilai] = cocok;
      if (!process.env[kunci]) process.env[kunci] = nilai.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* boleh tidak ada */
  }
}

muatEnv(".env.local");

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL atau DATABASE_URL belum diset di .env.local.");
  process.exit(1);
}

const argv = process.argv.slice(2);
const hanyaCek = argv.includes("--cek");
const iTandai = argv.indexOf("--tandai");
const untukDitandai = iTandai >= 0 ? argv.slice(iTandai + 1) : [];

const dirMigrasi = resolve(process.cwd(), "supabase/migrations");

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  // Seed 577 D.I. adalah satu perintah besar; beri waktu longgar.
  statement_timeout: 300_000,
});

try {
  await client.connect();
  const { rows } = await client.query("select current_database() db, version() v");
  console.log(`✓ Terhubung ke ${rows[0].db}`);
  console.log(`  ${rows[0].v.split(" ").slice(0, 2).join(" ")}\n`);
} catch (e) {
  console.error(`✗ Gagal terhubung: ${e.message}`);
  console.error("\n  Periksa: kata sandi sudah di-URL-encode? (# -> %23)");
  console.error("  Ambil connection string di Supabase -> Connect -> ORMs.");
  process.exit(1);
}

await client.query(`
  create table if not exists _migrasi (
    nama             text primary key,
    dijalankan_pada  timestamptz not null default now()
  )
`);

const { rows: tercatat } = await client.query("select nama from _migrasi");
const sudah = new Set(tercatat.map((r) => r.nama));

const berkas = readdirSync(dirMigrasi)
  .filter((f) => f.endsWith(".sql"))
  .sort();

async function ringkasan() {
  const tabel = ["upt", "indikator", "daerah_irigasi", "penilaian", "profil"];
  console.log("Status tabel:");
  for (const t of tabel) {
    try {
      const { rows } = await client.query(`select count(*)::int n from ${t}`);
      console.log(`  ${t.padEnd(16)} ${String(rows[0].n).padStart(5)} baris`);
    } catch {
      console.log(`  ${t.padEnd(16)}     – belum ada`);
    }
  }
}

if (hanyaCek) {
  console.log("Migrasi:");
  for (const nama of berkas) {
    console.log(`  ${sudah.has(nama) ? "✓" : "·"} ${nama}${sudah.has(nama) ? "" : "  (belum)"}`);
  }
  console.log("");
  await ringkasan();
  await client.end();
  process.exit(0);
}

/* Menandai berkas sebagai sudah dijalankan, tanpa mengeksekusinya. Dipakai
   ketika database sudah dimigrasi sebelum tabel pelacak ini ada. */
if (untukDitandai.length) {
  for (const nama of untukDitandai) {
    if (!berkas.includes(nama)) {
      console.error(`✗ ${nama} tidak ada di supabase/migrations/`);
      await client.end();
      process.exit(1);
    }
    await client.query("insert into _migrasi (nama) values ($1) on conflict do nothing", [nama]);
    console.log(`  ditandai sudah: ${nama}`);
  }
  console.log("");
  await client.end();
  process.exit(0);
}

const belum = berkas.filter((f) => !sudah.has(f));

if (belum.length === 0) {
  console.log("Tidak ada migrasi baru — semua sudah dijalankan.\n");
  await ringkasan();
  await client.end();
  process.exit(0);
}

console.log(`Menjalankan ${belum.length} migrasi baru (${berkas.length - belum.length} dilewati)\n`);

for (const nama of belum) {
  const sql = readFileSync(resolve(dirMigrasi, nama), "utf8");
  const mulai = Date.now();
  process.stdout.write(`  ${nama} … `);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into _migrasi (nama) values ($1)", [nama]);
    await client.query("commit");
    console.log(`selesai (${((Date.now() - mulai) / 1000).toFixed(1)}s)`);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    console.log("GAGAL");
    console.error(`\n✗ ${nama}: ${e.message}`);
    if (e.position) {
      const sekitar = sql.slice(Math.max(0, e.position - 160), Number(e.position) + 160);
      console.error(`\n  Sekitar posisi ${e.position}:\n  …${sekitar}…\n`);
    }
    console.error("  Perubahan berkas ini dibatalkan (rollback).");
    await client.end();
    process.exit(1);
  }
}

console.log("");
await ringkasan();
await client.end();
console.log("\n✓ Selesai.");
