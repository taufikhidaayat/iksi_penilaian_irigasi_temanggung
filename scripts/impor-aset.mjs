#!/usr/bin/env node
/**
 * Mengimpor aset irigasi dari "BUKU ASET IRIGASI WORD 2026.docx" ke tabel `aset`.
 *
 * Berkas .docx adalah arsip zip; isinya dibaca langsung dari word/document.xml
 * (91 MB) secara streaming supaya tidak memenuhi memori.
 *
 * Baris yang datanya meragukan TIDAK dibuang, melainkan ditandai `perlu_tinjau`
 * beserta alasannya, sehingga muncul sebagai daftar kerja di halaman Aset.
 *
 * Pemakaian:
 *   node scripts/impor-aset.mjs             # impor (kosongkan dulu tabelnya)
 *   node scripts/impor-aset.mjs --periksa   # hanya tampilkan ringkasan, tanpa menulis
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";
import yauzl from "yauzl";
import { SaxesParser } from "saxes";

/* ------------------------------------------------------------------ env */

function muatEnv(berkas) {
  try {
    for (const baris of readFileSync(resolve(process.cwd(), berkas), "utf8").split("\n")) {
      const c = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (c && !process.env[c[1]]) process.env[c[1]] = c[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* boleh tidak ada */
  }
}
muatEnv(".env.local");

const HANYA_PERIKSA = process.argv.includes("--periksa");
const BUKU = resolve(process.cwd(), "..", "BUKU ASET IRIGASI WORD 2026.docx");

/* ------------------------------------------------- pemetaan seksi -> jenis */

/** Urutan tabel di dalam dokumen. Tiga tabel pertama adalah tabel pedoman. */
const SEKSI = [
  null,
  null,
  null,
  ["3.1", "bendung"],
  ["3.2", "saluran"],
  ["3.3", "sadap"],
  ["3.4", "saluran_pelimpah"],
  ["3.5", "terjunan"],
  ["3.6", "talang"],
  ["3.7", "gorong_gorong"],
  ["3.8", "tanah_saluran"],
  ["3.9", "bangunan_pengaman"],
  ["4.1", "tanah_rumah"],
  ["4.2", "tanah_bangunan_saluran"],
  ["4.3", "tanah_saluran_ma"],
  ["4.4", "tanah_lambiran_sungai"],
  ["4.5", "tanah_lambiran_saluran"],
  ["4.6", "tanah_tidak_tersedia_kib"],
  ["4.7", "jalan_inspeksi"],
];

/** Jenis yang di buku memang tidak memakai nomenklatur. */
const TANPA_NOMENKLATUR = new Set([
  "tanah_saluran",
  "bangunan_pengaman",
  "tanah_rumah",
  "tanah_bangunan_saluran",
  "tanah_saluran_ma",
  "tanah_lambiran_sungai",
  "tanah_lambiran_saluran",
  "tanah_tidak_tersedia_kib",
  "jalan_inspeksi",
]);

/* ------------------------------------------- baca tabel dari document.xml */

function bukaDocumentXml(berkas) {
  return new Promise((selesai, gagal) => {
    yauzl.open(berkas, { lazyEntries: true }, (err, zip) => {
      if (err) return gagal(err);
      zip.readEntry();
      zip.on("entry", (entry) => {
        if (entry.fileName !== "word/document.xml") return zip.readEntry();
        zip.openReadStream(entry, (e2, stream) => (e2 ? gagal(e2) : selesai(stream)));
      });
      zip.on("end", () => gagal(new Error("word/document.xml tidak ditemukan")));
    });
  });
}

/**
 * Menelusuri XML sekali jalan dan mengumpulkan baris tabel.
 * Hanya melacak elemen yang perlu (tbl/tr/tc/t), jadi memori tetap datar.
 */
async function bacaBarisTabel(stream) {
  const parser = new SaxesParser();
  const baris = [];
  let nTabel = 0;
  let dalamTabel = false;
  let selSekarang = null;
  let barisSekarang = null;
  let kolom = null;
  let tumpukanTeks = 0;

  parser.on("opentag", (n) => {
    switch (n.name) {
      case "w:tbl":
        nTabel += 1;
        dalamTabel = true;
        kolom = null;
        break;
      case "w:tr":
        if (dalamTabel) barisSekarang = [];
        break;
      case "w:tc":
        if (barisSekarang) selSekarang = [];
        break;
      case "w:t":
        if (selSekarang) tumpukanTeks += 1;
        break;
    }
  });

  parser.on("text", (t) => {
    if (tumpukanTeks > 0 && selSekarang) selSekarang.push(t);
  });

  parser.on("closetag", (n) => {
    switch (n.name) {
      case "w:t":
        if (tumpukanTeks > 0) tumpukanTeks -= 1;
        break;
      case "w:tc":
        if (barisSekarang && selSekarang) barisSekarang.push(selSekarang.join("").trim());
        selSekarang = null;
        break;
      case "w:tr": {
        if (!barisSekarang) break;
        const adaIsi = barisSekarang.some((s) => s !== "");
        if (adaIsi) {
          if (kolom === null) kolom = barisSekarang.map((s) => s.toUpperCase());
          else baris.push({ tabel: nTabel, kolom, nilai: barisSekarang });
        }
        barisSekarang = null;
        break;
      }
      case "w:tbl":
        dalamTabel = false;
        kolom = null;
        break;
    }
  });

  await new Promise((selesai, gagal) => {
    stream.on("data", (potongan) => {
      try {
        parser.write(potongan.toString("utf8"));
      } catch (e) {
        gagal(e);
      }
    });
    stream.on("end", () => {
      parser.close();
      selesai();
    });
    stream.on("error", gagal);
  });

  return baris;
}

/* --------------------------------------------------------------- olah data */

const ambil = (b, ...nama) => {
  for (const n of nama) {
    const i = b.kolom.indexOf(n);
    if (i >= 0) return (b.nilai[i] ?? "").trim();
  }
  return "";
};

const rapikan = (s) => s.replace(/\s+/g, " ").trim();

function olah(b) {
  const info = SEKSI[b.tabel - 1];
  if (!info) return null;
  const [seksi, jenis] = info;

  const kodeMentah = rapikan(ambil(b, "NOMOR ASET", "NOMOR BANGUNAN"));
  const kode = kodeMentah.replace(/\s+/g, "");
  const nomenklatur = rapikan(ambil(b, "NOMENKLATUR", "NOMEN", "NOMENK"));
  const nama = rapikan(ambil(b, "NAMA ASET", "NAMA BARANG", "ASET TANAH", "NAMA BANGUNAN"));

  // Baris nomor urut saja (tanpa isi) dilewati.
  if (!kode && !nomenklatur && !nama) return null;

  const alasan = [];
  let kodeDi = null;
  const m = kode.match(/^33\.23\.010306\.(\d{3,4})\./);
  if (m) kodeDi = m[1].padStart(4, "0");

  if (!kode) alasan.push("nomor aset kosong");
  else if (kode.split(".").length !== 6) alasan.push("format nomor aset tidak baku");
  else if (!kodeDi) alasan.push("kode D.I. tidak terbaca dari nomor aset");

  if (!nomenklatur && !TANPA_NOMENKLATUR.has(jenis)) alasan.push("nomenklatur kosong");
  if (!nama) alasan.push("nama aset kosong");

  const tahunStr = kode.split(".")[5];
  const tahun = /^\d{4}$/.test(tahunStr ?? "") ? Number(tahunStr) : null;

  return {
    jenis,
    seksi_buku: seksi,
    kode: kode || null,
    nomenklatur: nomenklatur || null,
    nama: nama || "(tanpa nama)",
    kode_di_buku: kodeDi,
    nama_di_buku: rapikan(ambil(b, "NAMA DI")) || null,
    desa: rapikan(ambil(b, "DESA")) || null,
    kecamatan: rapikan(ambil(b, "KECAMATAN", "KEC")) || null,
    bangunan_hulu: rapikan(ambil(b, "BANGUNAN HULU")) || null,
    bangunan_hilir: rapikan(ambil(b, "BANGUNAN HILIR")) || null,
    tahun: tahun && tahun > 1900 && tahun < 2100 ? tahun : null,
    alasan,
  };
}

/* ------------------------------------------------------------------ jalan */

console.log(`\nMembaca ${BUKU.split(/[\\/]/).pop()} …`);
const stream = await bukaDocumentXml(BUKU);
const barisTabel = await bacaBarisTabel(stream);
console.log(`  ${barisTabel.length} baris tabel terbaca`);

const aset = barisTabel.map(olah).filter(Boolean);
console.log(`  ${aset.length} baris aset\n`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib ada di .env.local.");
  process.exit(1);
}
const sb = createClient(url, secret, { auth: { persistSession: false } });

// Peta kode D.I. 4 digit -> id, untuk menautkan aset ke daerah_irigasi.
const { data: diRows, error: eDi } = await sb
  .from("daerah_irigasi")
  .select("id, kode, nama")
  .limit(2000);
if (eDi) {
  console.error("Gagal membaca daerah_irigasi:", eDi.message);
  process.exit(1);
}
const petaDi = new Map(diRows.map((d) => [String(d.kode).slice(-4), d.id]));

const hitung = { total: aset.length, tertaut: 0, tanpaDi: 0, tinjau: 0 };
const perJenis = {};
const diTakDikenal = new Map();

for (const a of aset) {
  perJenis[a.jenis] = (perJenis[a.jenis] ?? 0) + 1;
  a.di_id = a.kode_di_buku ? (petaDi.get(a.kode_di_buku) ?? null) : null;
  if (a.di_id) hitung.tertaut += 1;
  else {
    hitung.tanpaDi += 1;
    if (a.kode_di_buku) {
      diTakDikenal.set(a.kode_di_buku, (diTakDikenal.get(a.kode_di_buku) ?? 0) + 1);
      a.alasan.push(`kode D.I. ${a.kode_di_buku} tidak ada di master`);
    }
  }
  a.perlu_tinjau = a.alasan.length > 0;
  a.alasan_tinjau = a.alasan.length ? a.alasan.join("; ") : null;
  delete a.alasan;
  if (a.perlu_tinjau) hitung.tinjau += 1;
}

console.log("Ringkasan per jenis:");
for (const [j, n] of Object.entries(perJenis).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${j.padEnd(26)} ${String(n).padStart(5)}`);
}
console.log(
  `\n  tertaut ke D.I. : ${hitung.tertaut}\n` +
    `  tanpa D.I.      : ${hitung.tanpaDi}\n` +
    `  perlu ditinjau  : ${hitung.tinjau}`,
);
if (diTakDikenal.size) {
  console.log("\n  kode D.I. tak dikenal:");
  for (const [k, n] of diTakDikenal) console.log(`    ${k} → ${n} aset`);
}

if (HANYA_PERIKSA) {
  console.log("\n(--periksa: tidak ada yang ditulis ke database)\n");
  process.exit(0);
}

/* ------------------------------------------------------------- tulis ke DB */

const { count: sudahAda } = await sb.from("aset").select("*", { count: "exact", head: true });
if (sudahAda) {
  console.log(`\nTabel aset sudah berisi ${sudahAda} baris — dikosongkan dulu.`);
  const { error } = await sb.from("aset").delete().gt("id", 0);
  if (error) {
    console.error("Gagal mengosongkan:", error.message);
    process.exit(1);
  }
}

console.log("\nMenulis ke database…");
const UKURAN = 500;
let ditulis = 0;
for (let i = 0; i < aset.length; i += UKURAN) {
  const potongan = aset.slice(i, i + UKURAN);
  const { error } = await sb.from("aset").insert(potongan);
  if (error) {
    console.error(`\nGagal pada baris ${i}: ${error.message}`);
    process.exit(1);
  }
  ditulis += potongan.length;
  process.stdout.write(`\r  ${ditulis}/${aset.length}`);
}

const { count: akhir } = await sb.from("aset").select("*", { count: "exact", head: true });
console.log(`\n\n✓ Selesai. Tabel aset berisi ${akhir} baris.\n`);
