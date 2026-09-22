#!/usr/bin/env node
/**
 * Melengkapi saluran di register aset dengan nama dan panjang dari berkas GIS.
 *
 * Dua hal yang diambil dari draf `saluran` (berkas 02.SALURAN FIX.xlsx):
 *
 *   `Nama_sal` -> aset.nama      mis. "SIRANDU SAL-4022"
 *   `panjang`  -> aset.panjang   dalam meter
 *
 * Alasannya, seluruh 4.642 saluran di register bernama sama persis, "Saluran
 * Sekunder". Petugas yang mengisi penilaian per ruas hanya melihat deretan
 * nama yang seragam dan tidak bisa memastikan ruas di layar adalah ruas yang
 * sedang ia periksa. Nama dari GIS memuat nama D.I. sekaligus kode ruasnya,
 * dan panjangnya jadi keping pembeda berikutnya.
 *
 * Baris dipasangkan lewat nomenklatur: `NUM` di berkas GIS berisi nilai yang
 * sama dengan `aset.nomenklatur` (mis. "SAL.04022"). Dari 4.600 nomenklatur di
 * register, seluruhnya ada di berkas GIS.
 *
 * Nomenklatur yang dipakai lebih dari satu baris DILEWATI, di kedua sisi.
 * Pada 19 nomenklatur, satu nomor dipakai beberapa ruas sekaligus sehingga
 * tidak ada cara memastikan ruas mana berpasangan dengan ruas mana; menebak
 * berarti memberi panjang ruas lain kepada ruas yang salah.
 *
 * Yang TIDAK disentuh: nomor aset, D.I. tautannya, desa, kecamatan, dan ruas
 * hulu-hilir. Skrip ini hanya melengkapi, bukan mengganti sumber data seperti
 * `ganti-aset-bendung`.
 *
 * Pemakaian:
 *   node scripts/lengkapi-saluran.mjs --periksa   # rencana saja, tanpa menulis
 *   node scripts/lengkapi-saluran.mjs             # jalankan
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

/** Nama di berkas GIS berspasi ganda ("SIRANDU  SAL-4022"); dirapikan. */
const rapikan = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib ada di .env.local.");
  process.exit(1);
}
const sb = createClient(url, secret, { auth: { persistSession: false } });

async function semua(tabel, kolom, saring, urut) {
  const out = [];
  for (let dari = 0; ; dari += 1000) {
    let q = sb.from(tabel).select(kolom);
    if (saring) q = saring(q);
    const { data, error } = await q.order(urut, { ascending: true }).range(dari, dari + 999);
    if (error) throw new Error(`${tabel}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const aset = await semua("aset", "id, nomenklatur, nama, panjang", (q) => q.eq("jenis", "saluran"), "id");
const draf = await semua(
  "aset_draf",
  "baris_ke, data",
  (q) => q.eq("jenis", "saluran"),
  "baris_ke",
);

if (draf.length === 0) {
  console.error("Draf `saluran` kosong. Jalankan `npm run impor-aset-draf` dulu.");
  process.exit(1);
}

/** Mengelompokkan menurut nomenklatur, supaya yang ganda bisa dikenali. */
function kelompokkan(daftar, ambilKunci) {
  const m = new Map();
  for (const x of daftar) {
    const k = ambilKunci(x);
    if (!k) continue;
    const arr = m.get(k) ?? m.set(k, []).get(k);
    arr.push(x);
  }
  return m;
}

const perNom = kelompokkan(aset, (a) => a.nomenklatur);
const perNum = kelompokkan(draf, (r) => rapikan(r.data.NUM));

const perbarui = [];
let takKetemu = 0;
let ganda = 0;
let samaSaja = 0;
const contohGanda = [];

for (const [nom, arrAset] of perNom) {
  const arrDraf = perNum.get(nom);
  if (!arrDraf) {
    takKetemu += arrAset.length;
    continue;
  }
  if (arrAset.length > 1 || arrDraf.length > 1) {
    ganda += arrAset.length;
    if (contohGanda.length < 5) {
      contohGanda.push(`${nom}: register ${arrAset.length} ruas, GIS ${arrDraf.length} ruas`);
    }
    continue;
  }

  const a = arrAset[0];
  const d = arrDraf[0];

  const nama = rapikan(d.data.Nama_sal) || a.nama;
  const angka = Number(d.data.panjang);
  // Panjang 0 disimpan apa adanya, bukan dijadikan null: 43 ruas memang
  // tercatat 0 di berkas GIS, dan itu keterangan yang berbeda artinya dari
  // "belum terdata".
  const panjang = Number.isFinite(angka) ? angka : null;

  const bedaNama = rapikan(a.nama) !== nama;
  const bedaPanjang = Number(a.panjang ?? NaN) !== (panjang ?? NaN);
  if (!bedaNama && !bedaPanjang) {
    samaSaja += 1;
    continue;
  }

  perbarui.push({ id: a.id, nomenklatur: nom, muatan: { nama, panjang } });
}

console.log("Rencana melengkapi saluran\n");
console.log(`  saluran di register        ${String(aset.length).padStart(5)}`);
console.log(`  saluran di berkas GIS      ${String(draf.length).padStart(5)}`);
console.log("");
console.log(`  akan diperbarui            ${String(perbarui.length).padStart(5)}`);
console.log(`  sudah sama, dilewati       ${String(samaSaja).padStart(5)}`);
console.log(`  nomenklatur ganda, dilewati${String(ganda).padStart(5)}`);
console.log(`  tidak ada di berkas GIS    ${String(takKetemu).padStart(5)}`);

if (contohGanda.length) {
  console.log("\n  contoh nomenklatur ganda:");
  contohGanda.forEach((c) => console.log(`    ${c}`));
}

const tanpaPanjang = perbarui.filter((p) => p.muatan.panjang === null).length;
const nol = perbarui.filter((p) => p.muatan.panjang === 0).length;
console.log(`\n  di antara yang diperbarui: ${tanpaPanjang} tanpa panjang, ${nol} panjangnya 0`);

console.log("\n  contoh hasilnya:");
for (const p of perbarui.slice(0, 5)) {
  console.log(`    ${p.nomenklatur}  "${p.muatan.nama}"  ${p.muatan.panjang} m`);
}

if (HANYA_PERIKSA) {
  console.log("\n(--periksa: tidak ada yang ditulis ke database)\n");
  process.exit(0);
}

if (perbarui.length === 0) {
  console.log("\nTidak ada yang perlu diubah.\n");
  process.exit(0);
}

console.log("\nMenulis ke database…");
const PARALEL = 25;
let n = 0;
for (let i = 0; i < perbarui.length; i += PARALEL) {
  const potongan = perbarui.slice(i, i + PARALEL);
  const hasil = await Promise.all(
    potongan.map((p) => sb.from("aset").update(p.muatan).eq("id", p.id)),
  );
  for (const [j, h] of hasil.entries()) {
    if (h.error) {
      console.error(`\nGagal pada id ${potongan[j].id}: ${h.error.message}`);
      process.exit(1);
    }
  }
  n += potongan.length;
  process.stdout.write(`\r  ${n}/${perbarui.length}`);
}
console.log();

const { count } = await sb
  .from("aset")
  .select("*", { count: "exact", head: true })
  .eq("jenis", "saluran")
  .not("panjang", "is", null);
console.log(`\n✓ Selesai. ${count} saluran kini punya panjang.\n`);
