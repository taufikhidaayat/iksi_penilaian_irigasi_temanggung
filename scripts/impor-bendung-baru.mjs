#!/usr/bin/env node
/**
 * Impor draf "Bendung Baru" dari data/aset-draf/SDY bendung Kab.dbf.
 *
 * Berkas ini datang dari GIS dalam format dBase, bukan .xlsx seperti delapan
 * berkas draf lainnya, jadi tidak bisa ikut scripts/impor-aset-draf.mjs.
 * Selebihnya sama persis: satu baris disimpan apa adanya di `data` (jsonb),
 * dan urutan kolomnya dicatat sekali di `aset_draf_berkas`.
 *
 * Isinya bendung juga, tetapi bukan sekadar versi lain dari 01.BENDUNG.xlsx:
 * 584 baris (xlsx 594) dan satu kolom tambahan, `UPT`. Keduanya sengaja
 * disimpan berdampingan sebagai dua kartu supaya bisa disandingkan dulu.
 *
 * Yang dihapus-tulis HANYA baris berjenis `bendung_baru`; delapan jenis draf
 * lainnya tidak disentuh.
 *
 * Pemakaian:
 *   node scripts/impor-bendung-baru.mjs            # impor (menimpa isi lama)
 *   node scripts/impor-bendung-baru.mjs --periksa  # ringkasan saja, tanpa menulis
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

const JENIS = "bendung_baru";
const BERKAS = "SDY bendung Kab.dbf";
const DIR = "data/aset-draf";
/** Kolom yang memuat nomor aset, sepadan dengan `kolom_kode` jenis draf lain. */
const KOLOM_KODE = "Nomor.Bang";
/** Nomor D.I. diambil dari kolom ini, bukan dari nomor aset. Alasannya di bawah. */
const KOLOM_DI = "Nomer DI";
/** UPT pengelola menurut berkas GIS; dipakai pada segmen ke-4 nomor aset. */
const KOLOM_UPT = "UPT";

/**
 * Pembetulan `Nomer DI` yang salah ketik di berkas GIS.
 *
 * Dibetulkan DI SINI, bukan di berkas .dbf-nya, supaya berkas dari Dinas tetap
 * utuh apa adanya dan setiap koreksi punya alasan tertulis yang bisa dibantah.
 *
 * Tiap entri menyebut nama bendungnya dan nomor asalnya sekaligus: kalau kelak
 * Dinas mengirim berkas yang sudah dibetulkan, entri ini tidak lagi cocok dan
 * dilewati begitu saja, bukan malah memindahkan baris yang sudah benar.
 */
const KOREKSI_DI = [
  {
    keterangan: "PMA SIRANCAH (MA)",
    dari: 258,
    ke: 252,
    // LAYER baris ini tertulis "DI SIRANCAH (MA)", dan di master D.I. 252
    // memang bernama "D.I. Sirancah (MA)" sedangkan 258 bernama "D.I. Sitalang
    // Kedu". Tanpa koreksi ini, D.I. 258 punya dua bendung dan 252 tidak punya
    // sama sekali.
    alasan: "LAYER berkas menyebut D.I. Sirancah (MA), yaitu nomor 252",
  },
];

/** Nama bendung dibakukan spasinya; beberapa nama di berkas berspasi ganda. */
const namaBaku = (v) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

/* ==================================================================== dBase
 *
 * dBase III: 32 byte header, lalu 32 byte per definisi kolom, ditutup 0x0D.
 * Tiap record diawali satu byte penanda hapus (0x2A = dihapus, 0x20 = aktif),
 * disusul nilai tiap kolom sebagai teks berpadding spasi dengan lebar tetap.
 *
 * Ditulis sendiri, bukan memakai pustaka: bagian format yang dipakai berkas
 * ini hanya belasan baris kode, dan satu berkas draf tidak sebanding dengan
 * menambah dependensi lagi.
 * ==================================================================== */

/**
 * Membaca seluruh isi berkas dBase.
 *
 * Teksnya diambil sebagai latin1. Berkas ini tidak disertai .cpg, jadi halaman
 * kodenya tidak dinyatakan di mana pun. Isinya nama desa dan kecamatan yang
 * seluruhnya ASCII, sehingga latin1 aman; kalaupun kelak ada huruf beraksen,
 * latin1 tidak pernah gagal membaca dan paling jauh salah memetakan satu
 * huruf, sementara UTF-8 akan menghasilkan karakter rusak di tengah baris
 * yang sebetulnya sah.
 */
function bacaDbf(lintasan) {
  const b = readFileSync(lintasan);

  const jumlahRecord = b.readUInt32LE(4);
  const panjangHeader = b.readUInt16LE(8);
  const panjangRecord = b.readUInt16LE(10);

  const kolom = [];
  for (let o = 32; b[o] !== 0x0d && o < panjangHeader; o += 32) {
    kolom.push({
      nama: b.toString("latin1", o, o + 11).replace(/\0.*$/, ""),
      tipe: String.fromCharCode(b[o + 11]),
      lebar: b[o + 16],
    });
  }

  const baris = [];
  let dihapus = 0;

  for (let i = 0; i < jumlahRecord; i++) {
    const awal = panjangHeader + i * panjangRecord;
    if (awal + panjangRecord > b.length) break;
    if (b[awal] === 0x2a) {
      dihapus += 1;
      continue;
    }

    let p = awal + 1;
    const data = {};
    for (const k of kolom) {
      const mentah = b.toString("latin1", p, p + k.lebar).trim();
      p += k.lebar;

      // Sel kosong disimpan null, sama seperti sel kosong berkas .xlsx, supaya
      // dua sumber bendung bisa dibandingkan tanpa "" lawan null ikut
      // terhitung sebagai perbedaan.
      if (mentah === "") {
        data[k.nama] = null;
      } else if (k.tipe === "N" || k.tipe === "F") {
        const n = Number(mentah);
        data[k.nama] = Number.isNaN(n) ? mentah : n;
      } else if (k.tipe === "L") {
        data[k.nama] = /^[YyTt]$/.test(mentah) ? true : /^[NnFf]$/.test(mentah) ? false : null;
      } else if (k.tipe === "D") {
        data[k.nama] = /^\d{8}$/.test(mentah)
          ? `${mentah.slice(0, 4)}-${mentah.slice(4, 6)}-${mentah.slice(6, 8)}`
          : mentah;
      } else {
        data[k.nama] = mentah;
      }
    }

    // `baris_ke` disamakan artinya dengan berkas .xlsx: header = 1, data mulai
    // dari 2. Berkas dBase tidak punya baris header, jadi nomornya digeser satu
    // supaya kolom "No." di layar terbaca sama untuk kedua sumber.
    baris.push({ barisKe: i + 2, data });
  }

  return { kolom: kolom.map((k) => k.nama), baris, dihapus, jumlahRecord };
}

/* ============================================================== kodefikasi
 * Salinan aturan yang sama dengan src/lib/aset.ts dan impor-aset-draf.mjs;
 * skrip ini berjalan di luar bundel Next, jadi tidak bisa mengimpornya.
 * ========================================================================= */

/** Segmen ke-3: `010306` untuk bangunan irigasi. Bendung selalu bangunan. */
function terapkanGolongan(kode) {
  if (!kode || kode.split(".").length < 3) return kode;
  return kode.replace(/^([^.]*\.[^.]*\.)[^.]*/, "$1010306");
}

/**
 * Segmen ke-4: 2 digit UPT + 3 digit nomor D.I. Lihat migrasi 0016.
 *
 * UPT-nya diambil dari kolom `UPT` berkas GIS, BUKAN dari
 * `daerah_irigasi.upt_id` seperti jenis draf lain. Menurut Dinas, pembagian
 * UPT di berkas GIS inilah yang mutakhir; master masih memuat pembagian lama
 * dan berbeda di 387 dari 584 baris.
 *
 * Bila kolom `UPT` kosong (satu baris: D.I. 523, BD Silumut Ngadirejo), UPT
 * master dipakai sebagai cadangan. Menebak sendiri berarti mengarang wilayah
 * pengelola, sedangkan master setidaknya punya dasar.
 */
function terapkanWilayah(kode, di, uptBerkas) {
  if (!kode || !di) return kode;
  const bagian = kode.split(".");
  // Segmen ke-4 lebih dari 5 digit berarti segmen ke-4 dan ke-5 tertulis
  // menyatu di berkas draf; menimpanya akan merusak segmen ke-5.
  if (bagian.length !== 6 || bagian[3].length > 5) return kode;

  const upt = uptBerkas ?? di.upt_id;
  const nomorDi = Number(String(di.kode).slice(-4));
  bagian[3] = String(upt).padStart(2, "0") + String(nomorDi).padStart(3, "0");
  return bagian.join(".");
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

const { kolom, baris: mentah, dihapus, jumlahRecord } = bacaDbf(resolve(DIR, BERKAS));

for (const wajib of [KOLOM_KODE, KOLOM_DI, KOLOM_UPT]) {
  if (!kolom.includes(wajib)) {
    console.error(`${BERKAS}: kolom "${wajib}" tidak ada. Kolom: ${kolom.join(", ")}`);
    process.exit(1);
  }
}

const rows = [];
let tertaut = 0;
let tanpaDi = 0;
let tanpaUpt = 0;
let uptBedaMaster = 0;
const dikoreksi = [];

for (const { barisKe, data } of mentah) {
  const kodeDraf = teks(data[KOLOM_KODE]).replace(/\s+/g, "") || null;

  /*
   * D.I. diambil dari kolom `Nomer DI`, BUKAN dari segmen ke-4 nomor aset
   * seperti pada delapan berkas draf .xlsx.
   *
   * Sebabnya nomor aset di berkas ini belum digarap: 584 baris hanya memuat 25
   * nomor yang berbeda, dan segmen ke-4-nya cuma 21 nilai, sehingga satu nomor
   * yang sama dipakai puluhan bendung sekaligus. Membaca D.I. dari situ akan
   * menaruh ratusan bendung di D.I. yang keliru.
   *
   * Kolom `Nomer DI` justru terisi penuh dan masuk akal: 584 baris, seluruhnya
   * di rentang 1..577, dengan 574 nomor berbeda.
   */
  let nomorDi = Number(data[KOLOM_DI]);
  const koreksi = KOREKSI_DI.find(
    (k) => k.dari === nomorDi && namaBaku(k.keterangan) === namaBaku(data.Keterangan),
  );
  if (koreksi) {
    nomorDi = koreksi.ke;
    dikoreksi.push(koreksi);
  }
  const di =
    Number.isFinite(nomorDi) && nomorDi > 0
      ? (petaDi.get(String(nomorDi).padStart(4, "0")) ?? null)
      : null;

  // UPT pengelola menurut berkas GIS; 1..6, di luar itu dianggap tidak terisi.
  const nomorUpt = Number(data[KOLOM_UPT]);
  const uptBerkas = Number.isInteger(nomorUpt) && nomorUpt >= 1 && nomorUpt <= 6 ? nomorUpt : null;
  if (di && !uptBerkas) tanpaUpt += 1;
  else if (di && uptBerkas !== di.upt_id) uptBedaMaster += 1;

  const kode = terapkanWilayah(terapkanGolongan(kodeDraf), di, uptBerkas);
  if (di) tertaut += 1;
  else tanpaDi += 1;

  // Nomor aset ikut masuk teks pencarian dalam dua bentuk, supaya petugas bisa
  // mencari pakai nomor berkas draf maupun nomor berformat SIKSI.
  const nilai = Object.values(data).map(teks).filter(Boolean);
  if (kode && kode !== kodeDraf) nilai.push(kode);

  rows.push({
    jenis: JENIS,
    baris_ke: barisKe,
    kode,
    kode_draf: kodeDraf,
    di_id: di?.id ?? null,
    data,
    teks_cari: nilai.join(" ").slice(0, 20000),
  });
}

console.log(
  `${BERKAS}\n` +
    `  ${jumlahRecord} record di header, ${rows.length} aktif, ${dihapus} bertanda hapus\n` +
    `  ${kolom.length} kolom\n` +
    `  tertaut D.I. ${tertaut}, tidak tertaut ${tanpaDi}\n` +
    `  UPT dari berkas: ${uptBedaMaster} berbeda dari master, ${tanpaUpt} kosong (pakai master)`,
);

for (const k of dikoreksi) {
  console.log(`  koreksi: ${k.keterangan} D.I. ${k.dari} -> ${k.ke} (${k.alasan})`);
}
// Koreksi yang tidak menemukan barisnya diberitahukan, bukan didiamkan: itu
// tanda berkasnya berubah dan entri koreksinya mungkin sudah tidak diperlukan.
for (const k of KOREKSI_DI.filter((x) => !dikoreksi.includes(x))) {
  console.log(`  catatan: koreksi ${k.keterangan} D.I. ${k.dari} -> ${k.ke} tidak terpakai`);
}

if (HANYA_PERIKSA) {
  console.log("\n(--periksa: tidak ada yang ditulis ke database)\n");
  process.exit(0);
}

console.log("\nMenulis ke database…");

// Dikosongkan dulu, bukan di-upsert: berkas draf bisa berubah jumlah barisnya,
// dan baris yang hilang dari berkas tidak boleh tertinggal di database.
const { error: eHapus } = await sb.from("aset_draf").delete().eq("jenis", JENIS);
if (eHapus) {
  console.error("Gagal mengosongkan baris lama:", eHapus.message);
  process.exit(1);
}

const { error: eBerkas } = await sb.from("aset_draf_berkas").upsert(
  {
    jenis: JENIS,
    nama_berkas: BERKAS,
    // Berkas dBase tidak punya sheet. Namanya diisi supaya ekspor ke .xlsx
    // tetap punya judul sheet yang berarti.
    nama_sheet: "BENDUNG BARU",
    kolom,
    kolom_kode: KOLOM_KODE,
    jumlah_baris: rows.length,
    diimpor_pada: new Date().toISOString(),
  },
  { onConflict: "jenis" },
);
if (eBerkas) {
  console.error("Gagal menulis metadata:", eBerkas.message);
  process.exit(1);
}

const UKURAN = 500;
let ditulis = 0;
for (let i = 0; i < rows.length; i += UKURAN) {
  const potongan = rows.slice(i, i + UKURAN);
  const { error } = await sb.from("aset_draf").insert(potongan);
  if (error) {
    console.error(`\nGagal pada baris ${i}: ${error.message}`);
    process.exit(1);
  }
  ditulis += potongan.length;
  process.stdout.write(`\r  ${ditulis}/${rows.length}`);
}
console.log();

const { count } = await sb
  .from("aset_draf")
  .select("*", { count: "exact", head: true })
  .eq("jenis", JENIS);
console.log(`\n✓ Selesai. ${count} baris berjenis ${JENIS} di tabel aset_draf.\n`);
