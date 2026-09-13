#!/usr/bin/env node
/**
 * Uji end-to-end koneksi & Row Level Security.
 *
 * Membuat dua pengguna sementara (satu UPT Ngadirejo, satu UPT Parakan),
 * masuk sebagai masing-masing, lalu memastikan:
 *   - pengunjung anonim tidak bisa membaca apa pun
 *   - pengguna yang sudah masuk bisa membaca data referensi
 *   - UPT hanya melihat penilaian wilayahnya sendiri
 *   - UPT tidak bisa membuat penilaian untuk D.I. milik UPT lain
 *   - admin melihat semuanya
 *
 * Seluruh data uji dihapus lagi di akhir.
 *
 * Pemakaian: node scripts/uji-koneksi.mjs
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY belum lengkap.");
  process.exit(1);
}

let gagal = 0;
const ok = (s) => console.log(`  [32m✓[0m ${s}`);
const no = (s) => {
  gagal++;
  console.log(`  [31m✗[0m ${s}`);
};

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SANDI = "UjiCoba#2026!";
const bikinEmail = (t) => `uji-${t}-${Date.now()}@iksi-test.local`;
const dibuat = [];

async function bikinPengguna(nama, peran, uptId) {
  const email = bikinEmail(peran + (uptId ?? ""));
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SANDI,
    email_confirm: true,
    user_metadata: { nama, peran, upt_id: uptId },
  });
  if (error) throw new Error(`gagal membuat pengguna uji: ${error.message}`);
  dibuat.push(data.user.id);
  return { email, id: data.user.id };
}

async function masuk(email) {
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password: SANDI });
  if (error) throw new Error(`gagal masuk sebagai ${email}: ${error.message}`);
  return sb;
}

try {
  /* ---------------------------------------------------------- anonim */
  console.log("\nPengunjung anonim (belum masuk)");
  {
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    for (const tabel of ["upt", "daerah_irigasi", "indikator", "penilaian"]) {
      const { data, error } = await sb.from(tabel).select("*").limit(1);
      if (error || (data && data.length === 0)) ok(`${tabel.padEnd(15)} tertutup`);
      else no(`BOCOR: anonim membaca ${data.length} baris dari ${tabel}`);
    }
    const { error: eTulis } = await sb
      .from("penilaian")
      .insert({ di_id: 1, upt_id: 1, tahun: 2026, triwulan: "Triwulan I" });
    if (eTulis) ok("tidak bisa menulis penilaian");
    else no("BOCOR: anonim menulis penilaian");
  }

  /* ------------------------------------------------- siapkan pengguna */
  console.log("\nMenyiapkan pengguna uji…");
  const uptNgadirejo = 3;
  const uptParakan = 2;
  const u1 = await bikinPengguna("Petugas Ngadirejo", "upt", uptNgadirejo);
  const u2 = await bikinPengguna("Petugas Parakan", "upt", uptParakan);
  const uAdmin = await bikinPengguna("Admin Uji", "admin", null);
  ok(`3 pengguna uji dibuat`);

  // Trigger handle_new_user() harus sudah mengisi tabel profil.
  const { data: profilCek } = await admin
    .from("profil")
    .select("id, peran, upt_id")
    .in("id", [u1.id, u2.id, uAdmin.id]);
  if (profilCek?.length === 3) ok("trigger mengisi profil untuk ketiganya");
  else no(`profil terbentuk ${profilCek?.length ?? 0} dari 3`);

  const pU1 = profilCek?.find((p) => p.id === u1.id);
  if (pU1?.upt_id === uptNgadirejo && pU1?.peran === "upt") ok("peran & UPT terisi benar dari metadata");
  else no(`profil UPT salah: ${JSON.stringify(pU1)}`);

  /* -------------------------------------------------- pengguna UPT */
  console.log("\nPengguna UPT (Regional III - Ngadirejo)");
  const sb1 = await masuk(u1.email);
  {
    const { data: upt } = await sb1.from("upt").select("id").order("urutan");
    if (upt?.length === 6) ok("bisa membaca 6 UPT");
    else no(`upt terbaca ${upt?.length}`);

    const { count } = await sb1
      .from("daerah_irigasi")
      .select("*", { count: "exact", head: true });
    if (count === 577) ok("bisa membaca 577 D.I.");
    else no(`daerah_irigasi terbaca ${count}`);

    const { count: cInd } = await sb1.from("indikator").select("*", { count: "exact", head: true });
    if (cInd === 270) ok("bisa membaca 270 indikator");
    else no(`indikator terbaca ${cInd}`);
  }

  /* -------------------------- penilaian: milik sendiri vs UPT lain */
  console.log("\nIsolasi data antar UPT");
  const { data: diNgadirejo } = await admin
    .from("daerah_irigasi")
    .select("id")
    .eq("upt_id", uptNgadirejo)
    .limit(1)
    .single();
  const { data: diParakan } = await admin
    .from("daerah_irigasi")
    .select("id")
    .eq("upt_id", uptParakan)
    .limit(1)
    .single();

  const { data: buatSendiri, error: eSendiri } = await sb1
    .from("penilaian")
    .insert({
      di_id: diNgadirejo.id,
      upt_id: uptNgadirejo,
      tahun: 2099,
      triwulan: "Triwulan I",
    })
    .select("id")
    .single();
  if (eSendiri) no(`gagal membuat penilaian untuk D.I. sendiri: ${eSendiri.message}`);
  else ok("UPT bisa membuat penilaian untuk D.I. wilayahnya");

  const { error: eLain } = await sb1.from("penilaian").insert({
    di_id: diParakan.id,
    upt_id: uptParakan,
    tahun: 2099,
    triwulan: "Triwulan I",
  });
  if (eLain) ok("UPT DITOLAK membuat penilaian untuk D.I. UPT lain");
  else no("BOCOR: UPT bisa membuat penilaian untuk D.I. UPT lain");

  // UPT Parakan tidak boleh melihat penilaian milik Ngadirejo.
  const sb2 = await masuk(u2.email);
  const { data: dilihatParakan } = await sb2
    .from("penilaian")
    .select("id")
    .eq("tahun", 2099);
  if (dilihatParakan?.length === 0) ok("UPT Parakan TIDAK melihat penilaian milik Ngadirejo");
  else no(`BOCOR: Parakan melihat ${dilihatParakan?.length} penilaian Ngadirejo`);

  const { data: dilihatSendiri } = await sb1
    .from("penilaian")
    .select("id")
    .eq("tahun", 2099);
  if (dilihatSendiri?.length === 1) ok("UPT Ngadirejo melihat penilaiannya sendiri");
  else no(`Ngadirejo melihat ${dilihatSendiri?.length} penilaian, seharusnya 1`);

  /* ------------------------------------------------------------ admin */
  console.log("\nAdministrator");
  const sbAdmin = await masuk(uAdmin.email);
  const { data: dilihatAdmin } = await sbAdmin
    .from("penilaian")
    .select("id")
    .eq("tahun", 2099);
  if (dilihatAdmin?.length === 1) ok("admin melihat penilaian seluruh UPT");
  else no(`admin melihat ${dilihatAdmin?.length} penilaian, seharusnya 1`);

  /* -------------------------------------------------------- bersihkan */
  if (buatSendiri?.id) {
    await admin.from("penilaian").delete().eq("id", buatSendiri.id);
  }
  await admin.from("penilaian").delete().eq("tahun", 2099);
} catch (e) {
  no(e.message);
} finally {
  console.log("\nMembersihkan data uji…");
  for (const id of dibuat) {
    await admin.auth.admin.deleteUser(id);
  }
  const { count } = await admin.from("penilaian").select("*", { count: "exact", head: true });
  ok(`${dibuat.length} pengguna uji dihapus · tabel penilaian kini ${count} baris`);
}

console.log(
  gagal === 0
    ? "\n[32m✓ Koneksi, autentikasi, dan isolasi antar UPT bekerja.[0m\n"
    : `\n[31m✗ ${gagal} pemeriksaan gagal.[0m\n`,
);
process.exit(gagal === 0 ? 0 : 1);
