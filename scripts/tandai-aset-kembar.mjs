#!/usr/bin/env node
/**
 * Menandai `perlu_tinjau` pada baris aset yang identik seluruh identitasnya.
 *
 * Yang disebut identik di sini adalah baris yang nomenklatur, nama, nomor
 * aset, D.I., desa, dan kecamatannya sama persis dengan baris lain. Aset
 * seperti itu tidak bisa dibedakan oleh siapa pun yang memeriksanya di
 * lapangan, jadi hampir pasti salah input ganda.
 *
 * Barisnya sengaja TIDAK dihapus. Menghapus salah satu berarti menebak mana
 * yang palsu, padahal bisa jadi memang ada dua bangunan berdampingan yang
 * datanya belum dibedakan. Menandainya menyerahkan keputusan itu kepada
 * petugas UPT yang mengenal lapangannya, dan barisnya muncul di daftar kerja
 * perapian lewat saringan "Perlu Ditinjau".
 *
 * Aman diulang: alasan yang sama tidak ditambahkan dua kali, dan baris yang
 * sudah tidak kembar lagi dilepas tandanya bila itu satu-satunya alasan.
 *
 * Pemakaian:
 *   node scripts/tandai-aset-kembar.mjs --periksa   # daftar saja, tanpa menulis
 *   node scripts/tandai-aset-kembar.mjs             # tandai
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

const HANYA_PERIKSA = process.argv.includes("--periksa");

/** Alasan yang dipasang skrip ini; dipakai juga untuk mengenali tanda lamanya. */
const ALASAN = "baris kembar: seluruh identitasnya sama dengan aset lain";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib ada di .env.local.");
  process.exit(1);
}
const sb = createClient(url, secret, { auth: { persistSession: false } });

const aset = [];
for (let dari = 0; ; dari += 1000) {
  const { data, error } = await sb
    .from("aset")
    .select("id, jenis, nomenklatur, nama, kode, di_id, desa, kecamatan, perlu_tinjau, alasan_tinjau")
    .order("id", { ascending: true })
    .range(dari, dari + 999);
  if (error) {
    console.error("Gagal membaca aset:", error.message);
    process.exit(1);
  }
  aset.push(...data);
  if (data.length < 1000) break;
}

// Kunci identitas disusun sama persis dengan view `ringkasan_aset` (migrasi
// 0018) dan `penandaKembar()` di src/lib/aset.ts, supaya ketiganya tidak
// pernah berbeda kesimpulan tentang baris mana yang kembar.
const kunci = (a) =>
  [
    a.jenis,
    a.nomenklatur ?? "",
    a.nama,
    a.kode ?? "",
    a.di_id ?? "",
    a.desa ?? "",
    a.kecamatan ?? "",
  ].join("|");

const kelompok = new Map();
for (const a of aset) {
  const k = kunci(a);
  const arr = kelompok.get(k) ?? kelompok.set(k, []).get(k);
  arr.push(a);
}

const kembar = [...kelompok.values()].filter((g) => g.length > 1);
const idKembar = new Set(kembar.flat().map((a) => a.id));

/** Menambahkan alasan tanpa menduplikasinya. */
function tambahAlasan(lama) {
  const bagian = (lama ?? "").split("; ").filter(Boolean);
  if (bagian.includes(ALASAN)) return null;
  return [...bagian, ALASAN].join("; ");
}

/**
 * Melepas alasan ini saja, membiarkan alasan lain apa adanya.
 *
 * Mengembalikan `undefined` bila tidak ada yang perlu dilepas, dan `null` bila
 * setelah dilepas tidak tersisa alasan apa pun. Keduanya harus dibedakan:
 * menyamakannya membuat baris yang alasannya memang bukan ini ikut dilepas
 * tandanya.
 */
function cabutAlasan(lama) {
  const bagian = (lama ?? "").split("; ").filter(Boolean);
  if (!bagian.includes(ALASAN)) return undefined;
  const sisa = bagian.filter((x) => x !== ALASAN);
  return sisa.length ? sisa.join("; ") : null;
}

const akanDitandai = [];
for (const a of kembar.flat()) {
  const alasan = tambahAlasan(a.alasan_tinjau);
  if (alasan === null && a.perlu_tinjau) continue;
  akanDitandai.push({ id: a.id, perlu_tinjau: true, alasan_tinjau: alasan ?? a.alasan_tinjau });
}

const akanDilepas = [];
for (const a of aset) {
  if (idKembar.has(a.id)) continue;
  const alasan = cabutAlasan(a.alasan_tinjau);
  if (alasan === undefined) continue;
  akanDilepas.push({ id: a.id, perlu_tinjau: alasan !== null, alasan_tinjau: alasan });
}

console.log(`Baris aset diperiksa   : ${aset.length}`);
console.log(`Kelompok baris kembar  : ${kembar.length}`);
console.log(`Baris yang terlibat    : ${idKembar.size}`);
console.log(`Akan ditandai          : ${akanDitandai.length}`);
console.log(`Tanda lama yang dilepas: ${akanDilepas.length}\n`);

for (const g of kembar) {
  console.log(`  ${g.length}x  ${g[0].jenis} | ${g[0].nama}`);
  console.log(
    `       nomor ${g[0].kode ?? "-"} | D.I. ${g[0].di_id ?? "-"} | ${g[0].desa ?? "-"}, ${g[0].kecamatan ?? "-"}`,
  );
  console.log(`       id: ${g.map((x) => x.id).join(", ")}`);
}

if (HANYA_PERIKSA) {
  console.log("\n(--periksa: tidak ada yang ditulis ke database)\n");
  process.exit(0);
}

const semua = [...akanDitandai, ...akanDilepas];
if (semua.length === 0) {
  console.log("\nTidak ada yang perlu diubah.\n");
  process.exit(0);
}

console.log("\nMenulis ke database…");
const PARALEL = 25;
for (let i = 0; i < semua.length; i += PARALEL) {
  const potongan = semua.slice(i, i + PARALEL);
  const hasil = await Promise.all(
    potongan.map((x) =>
      sb
        .from("aset")
        .update({ perlu_tinjau: x.perlu_tinjau, alasan_tinjau: x.alasan_tinjau })
        .eq("id", x.id),
    ),
  );
  for (const [j, h] of hasil.entries()) {
    if (h.error) {
      console.error(`Gagal pada id ${potongan[j].id}: ${h.error.message}`);
      process.exit(1);
    }
  }
}

console.log(`✓ Selesai. ${semua.length} baris diperbarui.\n`);
