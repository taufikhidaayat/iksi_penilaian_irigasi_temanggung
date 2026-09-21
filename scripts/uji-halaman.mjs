#!/usr/bin/env node
/**
 * Merender setiap halaman yang butuh login, sebagai admin dan sebagai UPT.
 *
 * Dibuat setelah sebuah bug lolos ke pengguna: `npm run build` dan uji halaman
 * /masuk sama-sama hijau, padahal setiap halaman di balik login gagal render
 * karena komponen ikon dikirim menembus batas server/klien. Build tidak bisa
 * menangkapnya — hanya render sungguhan yang bisa.
 *
 * Cara kerja: masuk lewat supabase-js untuk memperoleh sesi, menyusun cookie
 * dengan format yang sama seperti @supabase/ssr (prefix `base64-`, dipotong tiap
 * 3180 karakter), lalu mengambil tiap rute dan memeriksa penanda galat.
 *
 * Pemakaian:
 *   npm run dev            # di terminal lain
 *   node scripts/uji-halaman.mjs [http://localhost:3000]
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

const ASAL = process.argv[2] ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const refProyek = new URL(url).hostname.split(".")[0];
const NAMA_COOKIE = `sb-${refProyek}-auth-token`;
const MAX_POTONG = 3180;

let gagal = 0;
const ok = (s) => console.log(`  [32m✓[0m ${s}`);
const no = (s) => {
  gagal++;
  console.log(`  [31m✗[0m ${s}`);
};

/** base64url tanpa padding, sama seperti stringToBase64URL milik @supabase/ssr. */
function base64url(teks) {
  return Buffer.from(teks, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function cookieDariSesi(sesi) {
  const nilai = "base64-" + base64url(JSON.stringify(sesi));
  if (nilai.length <= MAX_POTONG) return `${NAMA_COOKIE}=${nilai}`;
  const potongan = [];
  for (let i = 0; i * MAX_POTONG < nilai.length; i++) {
    potongan.push(`${NAMA_COOKIE}.${i}=${nilai.slice(i * MAX_POTONG, (i + 1) * MAX_POTONG)}`);
  }
  return potongan.join("; ");
}

async function masuk(username, sandi) {
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  // Email hanyalah identitas internal yang diturunkan dari username.
  const email = `${username}@temanggungkab.go.id`;
  const { data, error } = await sb.auth.signInWithPassword({ email, password: sandi });
  if (error) throw new Error(`gagal masuk ${username}: ${error.message}`);
  return cookieDariSesi(data.session);
}

/**
 * Penanda bahwa Next mengirim halaman galat, bukan halaman sungguhan.
 *
 * Sengaja TIDAK memuat "This page could not be found": string itu selalu ikut
 * pada payload RSC sebagai batas not-found bawaan Next, bahkan pada halaman
 * yang sukses. Status 404 sendiri sudah tertangkap lewat pemeriksaan HTTP.
 */
const PENANDA_GALAT = [
  "Only plain objects can be passed",
  "Unhandled Runtime Error",
  "__next_error__",
  "Server Components render",
];

async function ambil(jalur, cookie, label) {
  let res;
  try {
    res = await fetch(ASAL + jalur, { headers: { cookie }, redirect: "manual" });
  } catch (e) {
    no(`${label.padEnd(8)} ${jalur.padEnd(18)} tidak bisa dihubungi: ${e.message}`);
    return null;
  }

  if (res.status === 307 || res.status === 302) {
    const tujuan = res.headers.get("location") ?? "";
    no(`${label.padEnd(8)} ${jalur.padEnd(18)} dialihkan ke ${tujuan} (sesi tidak terbaca?)`);
    return null;
  }
  if (res.status !== 200) {
    no(`${label.padEnd(8)} ${jalur.padEnd(18)} HTTP ${res.status}`);
    return null;
  }

  const html = await res.text();
  const ketemu = PENANDA_GALAT.find((p) => html.includes(p));
  if (ketemu) {
    no(`${label.padEnd(8)} ${jalur.padEnd(18)} halaman galat: "${ketemu}"`);
    return null;
  }
  return html;
}

const RUTE = [
  ["/", "Dasbor"],
  ["/penilaian", "Penilaian"],
  ["/rekap", "Rekapitulasi"],
  ["/ekspor", "Ekspor"],
  ["/daerah-irigasi", "Daerah Irigasi"],
  ["/aset", "Aset Irigasi"],
];

console.log(`\nMenguji render halaman di ${ASAL}\n`);

try {
  /* --------------------------------------------------------- admin */
  console.log("Sebagai Administrator");
  const ckAdmin = await masuk("admin", "IksiAdmin#2026");
  for (const [jalur, judul] of [
    ...RUTE,
    ["/pengguna", "Pengguna"],
    ["/aset-draf", "Data Aset Draf IKSI"],
    // Halaman draf terlebar: 62 kolom, semuanya dirender sekaligus. Yang
    // diperiksa nama kolom terjauh, bukan judul halaman — hanya itu yang
    // membuktikan seluruh tabel ikut terender, bukan cuma kepalanya.
    ["/aset-draf/bendung_baru", "type_bdgng"],
  ]) {
    const html = await ambil(jalur, ckAdmin, "admin");
    if (html && html.includes(judul)) ok(`admin    ${jalur.padEnd(18)} memuat "${judul}"`);
    else if (html) no(`admin    ${jalur.padEnd(18)} render tapi tanpa teks "${judul}"`);
  }

  // Ekspor Excel benar-benar menghasilkan berkas.
  const resXlsx = await fetch(`${ASAL}/api/ekspor?tahun=2026&triwulan=Triwulan+III`, {
    headers: { cookie: ckAdmin },
  });
  const tipe = resXlsx.headers.get("content-type") ?? "";
  const buf = Buffer.from(await resXlsx.arrayBuffer());
  // Berkas .xlsx adalah arsip zip — selalu diawali "PK".
  if (resXlsx.status === 200 && tipe.includes("spreadsheetml") && buf.subarray(0, 2).toString() === "PK") {
    ok(`admin    /api/ekspor        .xlsx ${(buf.length / 1024).toFixed(0)} KB`);
  } else {
    no(`admin    /api/ekspor        HTTP ${resXlsx.status}, tipe "${tipe}"`);
  }

  // Ekspor draf menyusun ulang .xlsx dari database.
  const resDraf = await fetch(`${ASAL}/api/aset-draf/talang`, { headers: { cookie: ckAdmin } });
  const tipeDraf = resDraf.headers.get("content-type") ?? "";
  const bufDraf = Buffer.from(await resDraf.arrayBuffer());
  if (
    resDraf.status === 200 &&
    tipeDraf.includes("spreadsheetml") &&
    bufDraf.subarray(0, 2).toString() === "PK"
  ) {
    ok(`admin    /api/aset-draf     .xlsx ${(bufDraf.length / 1024).toFixed(0)} KB`);
  } else {
    no(`admin    /api/aset-draf     HTTP ${resDraf.status}, tipe "${tipeDraf}"`);
  }

  // Berkas asli dikirim apa adanya dari data/aset-draf/.
  const resAsli = await fetch(`${ASAL}/api/aset-draf/talang?asli=1`, { headers: { cookie: ckAdmin } });
  const bufAsli = Buffer.from(await resAsli.arrayBuffer());
  if (resAsli.status === 200 && bufAsli.subarray(0, 2).toString() === "PK") {
    ok(`admin    /api/aset-draf?asli .xlsx ${(bufAsli.length / 1024).toFixed(0)} KB`);
  } else {
    no(`admin    /api/aset-draf?asli HTTP ${resAsli.status}`);
  }

  /* ----------------------------------------------------------- upt */
  console.log("\nSebagai Petugas UPT (Ngadirejo)");
  const ckUpt = await masuk("upt.ngadirejo", "UptIksi#2026");
  for (const [jalur, judul] of RUTE) {
    const html = await ambil(jalur, ckUpt, "upt");
    if (html && html.includes(judul)) ok(`upt      ${jalur.padEnd(18)} memuat "${judul}"`);
    else if (html) no(`upt      ${jalur.padEnd(18)} render tapi tanpa teks "${judul}"`);
  }

  // Halaman khusus admin harus menolak petugas UPT.
  for (const jalur of ["/pengguna", "/aset-draf", "/aset-draf/bendung_baru"]) {
    const res = await fetch(ASAL + jalur, { headers: { cookie: ckUpt }, redirect: "manual" });
    if (res.status === 307 || res.status === 302) ok(`upt      ${jalur.padEnd(18)} ditolak, dialihkan (benar)`);
    else no(`upt      ${jalur.padEnd(18)} HTTP ${res.status}, seharusnya dialihkan`);
  }

  // Route ekspor draf punya pemeriksaan sendiri: ia membaca berkas dari disk,
  // yang tidak tersentuh RLS.
  const resTolak = await fetch(`${ASAL}/api/aset-draf/talang`, { headers: { cookie: ckUpt } });
  if (resTolak.status === 403) ok("upt      /api/aset-draf     ditolak 403 (benar)");
  else no(`upt      /api/aset-draf     HTTP ${resTolak.status}, seharusnya 403`);

  /* ------------------------------------------------- form penilaian */
  // Halaman terbesar (158 indikator) — butuh satu penilaian yang benar-benar ada.
  console.log("\nForm penilaian");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: di } = await admin
    .from("daerah_irigasi")
    .select("id, nama")
    .eq("upt_id", 3)
    .limit(1)
    .single();
  const { data: baru, error: eBuat } = await admin
    .from("penilaian")
    .insert({ di_id: di.id, upt_id: 3, tahun: 2098, triwulan: "Triwulan I", kantong_lumpur: "ada" })
    .select("id")
    .single();

  if (eBuat) {
    no(`gagal menyiapkan penilaian uji: ${eBuat.message}`);
  } else {
    try {
      const html = await ambil(`/penilaian/${baru.id}`, ckUpt, "upt");
      if (html) {
        const wajib = [
          [di.nama, "nama D.I."],
          ["PRASARANA FISIK", "komponen I"],
          ["kantong lumpur", "toggle kantong lumpur"],
          ["Nilai IKSI", "panel skor"],
          ["Areal Terdampak", "tab areal"],
        ];
        for (const [teks, label] of wajib) {
          if (html.includes(teks)) ok(`upt      form penilaian     memuat ${label}`);
          else no(`upt      form penilaian     TANPA ${label}`);
        }
      }

      // UPT lain tidak boleh membuka penilaian ini.
      const ckLain = await masuk("upt.parakan", "UptIksi#2026");
      const rLain = await fetch(`${ASAL}/penilaian/${baru.id}`, {
        headers: { cookie: ckLain },
        redirect: "manual",
      });
      if (rLain.status === 404) ok("upt lain form penilaian     ditolak 404 (benar)");
      else no(`upt lain form penilaian     HTTP ${rLain.status}, seharusnya 404`);
    } finally {
      await admin.from("penilaian").delete().eq("id", baru.id);
      ok("penilaian uji dibersihkan");
    }
  }
} catch (e) {
  no(e.message);
}

console.log(
  gagal === 0
    ? "\n[32m✓ Semua halaman render dengan benar.[0m\n"
    : `\n[31m✗ ${gagal} pemeriksaan gagal.[0m\n`,
);
process.exit(gagal === 0 ? 0 : 1);
