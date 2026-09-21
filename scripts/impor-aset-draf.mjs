#!/usr/bin/env node
/**
 * Impor "Data Aset Draf IKSI" dari data/aset-draf/*.xlsx ke tabel aset_draf.
 *
 * Tiap berkas satu jenis aset, satu sheet, baris pertama header. Susunan
 * kolomnya berbeda-beda (Bendung 62, Tanah Saluran 12), jadi baris disimpan
 * sebagai jsonb dan urutan kolomnya dicatat sekali di aset_draf_berkas.
 *
 * Kolom `kode` diisi nomor berformat SIKSI: golongan di segmen ke-3, UPT +
 * nomor D.I. di segmen ke-4, sama persis dengan menu Aset Irigasi. Nomor asli
 * berkas draf tetap tersimpan di `kode_draf` dan tetap ikut dicari.
 *
 * Pemakaian:
 *   node scripts/impor-aset-draf.mjs            # impor (menimpa isi lama)
 *   node scripts/impor-aset-draf.mjs --periksa  # ringkasan saja, tanpa menulis
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import ExcelJS from "exceljs";
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
const DIR = "data/aset-draf";

/**
 * Berkas draf -> jenis aset, dan kolom mana yang memuat nomor aset.
 *
 * Nama kolomnya tidak seragam antar berkas ("Nomor.Bang", "NOMOR BANG",
 * "Nomor Tanh"), jadi dipetakan di sini daripada ditebak.
 */
const BERKAS = [
  // 01.BENDUNG.xlsx sengaja TIDAK diimpor lagi: Dinas memakai berkas GIS
  // `SDY bendung Kab.dbf` (jenis `bendung_baru`, lihat impor-bendung-baru).
  // Berkasnya tetap disimpan di data/aset-draf/ sebagai rujukan.
  { berkas: "02.SALURAN FIX.xlsx", jenis: "saluran", kolomKode: "Nomor.Bang" },
  { berkas: "03.SADAP FIX.xlsx", jenis: "sadap", kolomKode: "Nomor.Bang" },
  { berkas: "04.PELIMPAH FIX.xlsx", jenis: "saluran_pelimpah", kolomKode: "NOMOR BANG" },
  { berkas: "05.TERJUNAN FIX.xlsx", jenis: "terjunan", kolomKode: "Nomor.Bang" },
  { berkas: "06.TALANG FIX.xlsx", jenis: "talang", kolomKode: "Nomor.Bang" },
  { berkas: "07.GORONG GORONG FIX.xlsx", jenis: "gorong_gorong", kolomKode: "Nomor.Bang" },
  { berkas: "12,TANAH SALURAN FIXXXX.xlsx", jenis: "tanah_saluran", kolomKode: "Nomor Tanh" },
];

/** Golongan 01 pada segmen ke-3 nomor aset; sisanya golongan 02 (tanah). */
const JENIS_BANGUNAN = new Set([
  "bendung",
  "saluran",
  "sadap",
  "saluran_pelimpah",
  "terjunan",
  "talang",
  "gorong_gorong",
  "bangunan_pengaman",
]);

/** Segmen ke-3 menurut golongan: 01 bangunan, 02 tanah. Lihat migrasi 0014. */
function segmenGolongan(jenis) {
  return JENIS_BANGUNAN.has(jenis) ? "010306" : "020306";
}

/**
 * Membetulkan segmen golongan tanpa menyentuh bagian lain nomornya.
 *
 * Berkas draf menulis `010306` untuk seluruh baris, termasuk tanah saluran.
 * Regex hanya menyasar ruas ke-3; dua nomor di berkas draf punya segmen ke-4
 * dan ke-5 yang tertulis menyatu, dan bagian itu harus lewat apa adanya.
 */
function terapkanGolongan(kode, jenis) {
  if (!kode || kode.split(".").length < 3) return kode;
  return kode.replace(/^([^.]*\.[^.]*\.)[^.]*/, `$1${segmenGolongan(jenis)}`);
}

/** Segmen wilayah: 2 digit UPT + 3 digit nomor D.I. Lihat migrasi 0016. */
function kodefikasi(kode, di) {
  if (!kode || !di) return kode;
  const bagian = kode.split(".");
  // Segmen ke-4 lebih dari 5 digit berarti segmen ke-4 dan ke-5 tertulis
  // menyatu di berkas draf (14 baris); menimpanya merusak segmen ke-5.
  if (bagian.length !== 6 || bagian[3].length > 5) return kode;
  const nomorDi = Number(String(di.kode).slice(-4));
  bagian[3] = String(di.upt_id).padStart(2, "0") + String(nomorDi).padStart(3, "0");
  return bagian.join(".");
}

/**
 * Nilai sel jadi sesuatu yang bisa disimpan di jsonb.
 *
 * ExcelJS mengembalikan objek untuk rich text, hyperlink, rumus, dan galat.
 * Yang dipakai adalah teks yang terlihat di Excel, bukan bungkusnya.
 */
function nilaiSel(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return v.result === null ? null : String(v.result);
    if (v.error !== undefined) return String(v.error);
    if (v.hyperlink !== undefined) return String(v.hyperlink);
    return null;
  }
  return v;
}

const teks = (v) => (v === null || v === undefined ? "" : String(v));

/* ------------------------------------------------------------------ jalan */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib ada di .env.local.");
  process.exit(1);
}
const sb = createClient(url, secret, { auth: { persistSession: false } });

const { data: diRows, error: eDi } = await sb
  .from("daerah_irigasi")
  .select("id, kode, upt_id")
  .limit(2000);
if (eDi) {
  console.error("Gagal membaca daerah_irigasi:", eDi.message);
  process.exit(1);
}
const petaDi = new Map(diRows.map((d) => [String(d.kode).slice(-4), d]));

const ringkas = [];

for (const { berkas, jenis, kolomKode } of BERKAS) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(resolve(DIR, berkas));
  const ws = wb.worksheets[0];

  const kolom = [];
  for (let c = 1; c <= ws.columnCount; c++) {
    const nama = teks(nilaiSel(ws.getRow(1).getCell(c).value)).trim();
    // Kolom tanpa judul tetap disimpan: membuangnya akan menggeser kolom
    // berikutnya saat ekspor. Diberi nama posisi supaya kuncinya unik.
    kolom.push(nama || `(kolom ${c})`);
  }
  if (kolomKode && !kolom.includes(kolomKode)) {
    console.error(`${berkas}: kolom kode "${kolomKode}" tidak ada. Kolom: ${kolom.join(", ")}`);
    process.exit(1);
  }

  const baris = [];
  let terkodefikasi = 0;
  let tanpaDi = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const data = {};
    let adaIsi = false;
    for (let c = 1; c <= ws.columnCount; c++) {
      const v = nilaiSel(row.getCell(c).value);
      data[kolom[c - 1]] = v;
      if (teks(v).trim()) adaIsi = true;
    }
    if (!adaIsi) continue;

    const kodeDraf = kolomKode ? teks(data[kolomKode]).replace(/\s+/g, "") || null : null;
    let di = null;
    if (kodeDraf) {
      const bagian = kodeDraf.split(".");
      if (bagian.length === 6 && bagian[3].length <= 4) {
        di = petaDi.get(bagian[3].padStart(4, "0")) ?? null;
      }
    }
    const kode = kodefikasi(terapkanGolongan(kodeDraf, jenis), di);
    if (kodeDraf && kode !== kodeDraf) terkodefikasi += 1;
    else if (kodeDraf) tanpaDi += 1;

    // Nomor aset ikut masuk teks pencarian dalam dua bentuk, supaya petugas
    // bisa mencari pakai nomor berkas draf maupun nomor berformat SIKSI.
    const nilai = Object.values(data).map(teks).filter(Boolean);
    if (kode && kode !== kodeDraf) nilai.push(kode);

    baris.push({
      jenis,
      baris_ke: r,
      // Golongan dan wilayah dipasang persis seperti di menu Aset Irigasi,
      // supaya nomor di kedua menu bisa disandingkan langsung.
      kode,
      kode_draf: kodeDraf,
      di_id: di?.id ?? null,
      data,
      teks_cari: nilai.join(" ").slice(0, 20000),
    });
  }

  ringkas.push({ berkas, jenis, sheet: ws.name, kolom, baris, terkodefikasi, tanpaDi, kolomKode });
  console.log(
    `${berkas.padEnd(30)} ${jenis.padEnd(18)} ${String(baris.length).padStart(5)} baris · ` +
      `${kolom.length} kolom · kode dikonversi ${terkodefikasi}, tidak ${tanpaDi}`,
  );
}

const total = ringkas.reduce((n, r) => n + r.baris.length, 0);
console.log(`\nTotal ${total} baris dari ${ringkas.length} berkas.`);

if (HANYA_PERIKSA) {
  console.log("\n(--periksa: tidak ada yang ditulis ke database)\n");
  process.exit(0);
}

console.log("\nMenulis ke database…");
// Dikosongkan dulu, bukan di-upsert: berkas draf bisa berubah jumlah barisnya,
// dan baris yang hilang dari berkas tidak boleh tertinggal di database.
//
// Yang dihapus hanya jenis yang diurus skrip ini. Jenis draf lain punya skrip
// impornya sendiri (mis. `impor-bendung-baru` untuk berkas .dbf), dan
// mengosongkan seluruh tabel akan menghapus hasilnya tanpa ada yang tahu.
const { error: eHapus } = await sb
  .from("aset_draf")
  .delete()
  .in("jenis", BERKAS.map((b) => b.jenis));
if (eHapus) {
  console.error("Gagal mengosongkan aset_draf:", eHapus.message);
  process.exit(1);
}

for (const r of ringkas) {
  const { error: eBerkas } = await sb.from("aset_draf_berkas").upsert(
    {
      jenis: r.jenis,
      nama_berkas: r.berkas,
      nama_sheet: r.sheet,
      kolom: r.kolom,
      kolom_kode: r.kolomKode,
      jumlah_baris: r.baris.length,
      diimpor_pada: new Date().toISOString(),
    },
    { onConflict: "jenis" },
  );
  if (eBerkas) {
    console.error(`Gagal menulis metadata ${r.jenis}:`, eBerkas.message);
    process.exit(1);
  }

  const UKURAN = 500;
  let ditulis = 0;
  for (let i = 0; i < r.baris.length; i += UKURAN) {
    const potongan = r.baris.slice(i, i + UKURAN);
    const { error } = await sb.from("aset_draf").insert(potongan);
    if (error) {
      console.error(`\nGagal pada ${r.jenis} baris ${i}: ${error.message}`);
      process.exit(1);
    }
    ditulis += potongan.length;
    process.stdout.write(`\r  ${r.jenis.padEnd(18)} ${ditulis}/${r.baris.length}`);
  }
  console.log();
}

const { count } = await sb.from("aset_draf").select("*", { count: "exact", head: true });
console.log(`\n✓ Selesai. Tabel aset_draf berisi ${count} baris.\n`);
