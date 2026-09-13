#!/usr/bin/env node
/**
 * Memeriksa kesehatan database setelah migrasi:
 *  - RLS aktif di semua tabel dan setiap tabel punya policy
 *  - trigger profil otomatis terpasang
 *  - katalog indikator utuh (bobot berjumlah 100, tidak ada yatim)
 *  - master data lengkap
 *
 * Pemakaian: node scripts/verifikasi-db.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

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

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

let gagal = 0;
const ok = (s) => console.log(`  [32m✓[0m ${s}`);
const no = (s) => {
  gagal++;
  console.log(`  [31m✗[0m ${s}`);
};

const TABEL = [
  "upt",
  "profil",
  "daerah_irigasi",
  "indikator",
  "penilaian",
  "penilaian_nilai",
  "areal_terdampak",
];

console.log("\nRow Level Security");
{
  const { rows } = await client.query(
    `select c.relname tabel, c.relrowsecurity aktif,
            (select count(*) from pg_policies p
              where p.schemaname='public' and p.tablename=c.relname)::int policy
       from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname = any($1) order by c.relname`,
    [TABEL],
  );
  for (const t of TABEL) {
    const r = rows.find((x) => x.tabel === t);
    if (!r) no(`${t} — tabel tidak ditemukan`);
    else if (!r.aktif) no(`${t} — RLS TIDAK aktif`);
    else if (r.policy === 0) no(`${t} — RLS aktif tapi tanpa policy (semua akses tertutup)`);
    else ok(`${t.padEnd(17)} RLS aktif, ${r.policy} policy`);
  }
}

console.log("\nFungsi & trigger");
{
  const { rows } = await client.query(
    `select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and proname = any($1)`,
    [["auth_peran", "auth_upt_id", "is_admin", "boleh_akses_upt", "handle_new_user"]],
  );
  const ada = new Set(rows.map((r) => r.proname));
  for (const f of ["auth_peran", "auth_upt_id", "is_admin", "boleh_akses_upt", "handle_new_user"]) {
    if (ada.has(f)) ok(`fungsi ${f}()`);
    else no(`fungsi ${f}() hilang`);
  }

  const { rows: trg } = await client.query(
    `select tgname from pg_trigger where tgname = 'on_auth_user_created' and not tgisinternal`,
  );
  if (trg.length) ok("trigger on_auth_user_created (profil otomatis saat daftar)");
  else no("trigger on_auth_user_created hilang — profil tidak akan terbuat otomatis");
}

console.log("\nMaster data");
{
  const cek = [
    ["upt", 6],
    ["indikator", 270],
    ["daerah_irigasi", 577],
  ];
  for (const [t, harap] of cek) {
    const { rows } = await client.query(`select count(*)::int n from ${t}`);
    if (rows[0].n === harap) ok(`${t.padEnd(17)} ${rows[0].n} baris`);
    else no(`${t} berisi ${rows[0].n} baris, seharusnya ${harap}`);
  }

  const { rows: tanpaUpt } = await client.query(
    `select count(*)::int n from daerah_irigasi where upt_id is null`,
  );
  if (tanpaUpt[0].n === 0) ok("semua D.I. punya UPT");
  else no(`${tanpaUpt[0].n} D.I. tidak punya UPT`);
}

console.log("\nIntegritas katalog indikator");
{
  const { rows: daun } = await client.query(
    `select count(*)::int n from indikator where agregasi = 'leaf'`,
  );
  if (daun[0].n === 158) ok(`158 indikator input`);
  else no(`indikator input ${daun[0].n}, seharusnya 158`);

  const { rows: akar } = await client.query(
    `select sum(bobot_ada)::float a, sum(bobot_tidak)::float t
       from indikator where parent_kode is null`,
  );
  if (Math.abs(akar[0].a - 100) < 1e-9 && Math.abs(akar[0].t - 100) < 1e-9) ok("bobot 6 komponen utama berjumlah 100 pada kedua skenario kantong lumpur");
  else no(`bobot komponen utama: ada=${akar[0].a}, tidak=${akar[0].t} (seharusnya 100)`);

  const { rows: yatim } = await client.query(
    `select count(*)::int n from indikator i
      where i.parent_kode is not null
        and not exists (select 1 from indikator p where p.kode = i.parent_kode)`,
  );
  if (yatim[0].n === 0) ok("tidak ada indikator yatim");
  else no(`${yatim[0].n} indikator tanpa induk`);

  // Setiap node weighted_children wajib punya anak berbobot total 100.
  const { rows: bobot } = await client.query(
    `select i.kode, sum(a.bobot_ada)::float ada, sum(a.bobot_tidak)::float tidak
       from indikator i join indikator a on a.parent_kode = i.kode
      where i.agregasi = 'weighted_children'
      group by i.kode
     having abs(sum(a.bobot_ada) - 100) > 1e-9 or abs(sum(a.bobot_tidak) - 100) > 1e-9`,
  );
  if (bobot.length === 0) ok("bobot anak pada setiap node weighted_children berjumlah 100");
  else no(`${bobot.length} node bobot anaknya tidak 100: ${bobot.map((b) => b.kode).join(", ")}`);
}

await client.end();

console.log(
  gagal === 0
    ? "\n[32m✓ Database sehat — siap dipakai.[0m\n"
    : `\n[31m✗ ${gagal} pemeriksaan gagal.[0m\n`,
);
process.exit(gagal === 0 ? 0 : 1);
