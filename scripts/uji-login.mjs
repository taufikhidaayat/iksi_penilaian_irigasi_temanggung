#!/usr/bin/env node
/**
 * Menguji FORM login sungguhan, bukan sekadar memanggil supabase-js.
 *
 * Dibuat setelah login gagal padahal seluruh uji lain hijau: `uji-halaman.mjs`
 * menyusun cookie sesi sendiri lewat supabase-js, sehingga Server Action
 * `masuk()` — jalur yang sebenarnya dipakai orang saat menekan tombol Masuk —
 * tidak pernah tersentuh.
 *
 * Caranya meniru pengiriman form tanpa JavaScript (progressive enhancement):
 * ambil field tersembunyi `$ACTION_*` dari HTML, lalu POST multipart ke /masuk.
 * Ini jalur kode yang sama dengan yang dipakai browser.
 *
 * Pemakaian:
 *   npm run dev            # di terminal lain
 *   node scripts/uji-login.mjs [http://localhost:3000]
 */

const ASAL = process.argv[2] ?? "http://localhost:3000";

let gagal = 0;
const ok = (s) => console.log(`  [32m✓[0m ${s}`);
const no = (s) => {
  gagal++;
  console.log(`  [31m✗[0m ${s}`);
};

function lepasEntitas(t) {
  return t
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'");
}

/** Ambil field tersembunyi $ACTION_* yang dipakai Next untuk mengenali aksi. */
async function ambilFieldAksi() {
  const html = await (await fetch(`${ASAL}/masuk`)).text();
  const field = {};
  for (const m of html.matchAll(/name="(\$ACTION[^"]*)"(?:\s+value="([^"]*)")?/g)) {
    field[lepasEntitas(m[1])] = m[2] ? lepasEntitas(m[2]) : "";
  }
  if (!Object.keys(field).length) {
    throw new Error("field $ACTION tidak ditemukan — apakah /masuk merender form?");
  }
  return { field, html };
}

async function cobaMasuk(username, sandi) {
  const { field } = await ambilFieldAksi();
  const fd = new FormData();
  for (const [k, v] of Object.entries(field)) fd.set(k, v);
  fd.set("username", username);
  fd.set("sandi", sandi);

  const res = await fetch(`${ASAL}/masuk`, {
    method: "POST",
    body: fd,
    redirect: "manual",
  });
  const teks = await res.text();
  const kuki = res.headers.getSetCookie?.() ?? [];
  return {
    status: res.status,
    lokasi: res.headers.get("location") ?? res.headers.get("x-action-redirect") ?? "",
    teks,
    // Sesi tersimpan sebagai cookie sb-<ref>-auth-token.
    dapatSesi: kuki.some((c) => /sb-.*-auth-token(\.\d+)?=(?!;)/.test(c) && !/=;/.test(c)),
  };
}

console.log(`\nMenguji form login di ${ASAL}\n`);

try {
  /* ---------------------------------------------------- form dirender */
  const { html } = await ambilFieldAksi();
  if (html.includes('name="username"')) ok("form meminta Username");
  else no("form TIDAK punya field username");
  if (html.includes('name="sandi"')) ok("form meminta kata sandi");
  else no("form TIDAK punya field sandi");
  if (!html.includes("Alamat Email")) ok("tidak ada lagi field Alamat Email");
  else no("form masih meminta Alamat Email (server lama?)");

  /* ------------------------------------------------------ kredensial benar */
  console.log("\nKredensial benar");
  for (const [u, s, label] of [
    ["admin", "IksiAdmin#2026", "Administrator"],
    ["upt.ngadirejo", "UptIksi#2026", "UPT Ngadirejo"],
    ["UPT.NGADIREJO", "UptIksi#2026", "huruf besar (harus dinormalkan)"],
    ["  upt.parakan  ", "UptIksi#2026", "berspasi (harus dirapikan)"],
  ]) {
    const r = await cobaMasuk(u, s);
    if (r.dapatSesi) ok(`${label.padEnd(34)} dapat cookie sesi`);
    else no(`${label.padEnd(34)} GAGAL — status ${r.status}, tidak ada cookie sesi`);
  }

  /* ------------------------------------------------------ kredensial salah */
  console.log("\nKredensial salah (harus ditolak)");
  for (const [u, s, label] of [
    ["admin", "SandiSalah#1", "sandi salah"],
    ["tidakada", "UptIksi#2026", "username tidak terdaftar"],
    ["upt.ngadirejo", "", "sandi kosong"],
    ["", "UptIksi#2026", "username kosong"],
  ]) {
    const r = await cobaMasuk(u, s);
    if (!r.dapatSesi) ok(`${label.padEnd(34)} ditolak`);
    else no(`${label.padEnd(34)} BOCOR — malah dapat sesi`);
  }

  /* ------------------------------------- pesan tidak membocorkan info */
  console.log("\nPesan galat");
  const rSalahSandi = await cobaMasuk("admin", "SandiSalah#1");
  const rTakAda = await cobaMasuk("tidakadaakun", "SandiSalah#1");
  const pesan = /Username atau kata sandi salah/;
  if (pesan.test(rSalahSandi.teks) && pesan.test(rTakAda.teks)) {
    ok("pesan sama untuk sandi salah dan username tak terdaftar");
  } else {
    no("pesan galat membedakan keduanya — username bisa ditebak dari luar");
  }
} catch (e) {
  no(e.message);
}

console.log(
  gagal === 0
    ? "\n[32m✓ Form login bekerja.[0m\n"
    : `\n[31m✗ ${gagal} pemeriksaan gagal.[0m\n`,
);
process.exit(gagal === 0 ? 0 : 1);
