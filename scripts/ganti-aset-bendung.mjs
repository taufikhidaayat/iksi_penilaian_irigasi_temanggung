#!/usr/bin/env node
/**
 * Mengganti data aset Bendung di register resmi dengan data draf "Bendung Baru".
 *
 * Sumbernya tabel `aset_draf` jenis `bendung_baru` (hasil `npm run
 * impor-bendung-baru`), bukan berkas .dbf-nya langsung: draf itu sudah
 * tertaut D.I. dan sudah diperiksa, jadi hanya ada satu jalur pembacaan.
 *
 * Baris dipasangkan lewat nomenklatur: kolom `NUM` di berkas GIS berisi nilai
 * yang sama dengan `aset.nomenklatur` (mis. "BNDG.0517"). Keduanya unik, dan
 * pasangannya jatuh 1:1 tanpa sisa yang ambigu:
 *
 *     558 baris  NUM ketemu  -> baris aset LAMA DIPERBARUI di tempat
 *      26 baris  NUM kosong  -> aset BARU disisipkan
 *       8 aset   tidak ada di berkas GIS -> lihat --hapus-sisa
 *
 * Yang 558 sengaja DIPERBARUI, bukan dihapus lalu disisipkan ulang, supaya
 * `aset.id` tidak berubah. Penilaian per bangunan menunjuk id itu dengan
 * `on delete cascade`; menghapusnya akan ikut menghapus nilai yang sudah diisi
 * petugas tanpa ada yang tahu.
 *
 * Nomor asetnya memakai aturan yang sama persis dengan menu Aset Irigasi
 * (golongan di segmen ke-3, UPT + nomor D.I. di segmen ke-4), dihitung ulang
 * dari `kode_buku` memakai D.I. yang baru. Nomor buku tidak pernah diubah.
 *
 * Pemakaian:
 *   node scripts/ganti-aset-bendung.mjs --periksa     # rencana saja, tanpa menulis
 *   node scripts/ganti-aset-bendung.mjs               # jalankan, 8 sisa dipertahankan
 *   node scripts/ganti-aset-bendung.mjs --hapus-sisa  # jalankan, 8 sisa dihapus
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const HAPUS_SISA = process.argv.includes("--hapus-sisa");

const DIR_CADANGAN = "data/cadangan";

/* ============================================================== kodefikasi
 * Salinan aturan di src/lib/aset.ts; skrip ini jalan di luar bundel Next.
 * ========================================================================= */

/** Segmen ke-3: `010306` untuk bangunan irigasi. Bendung selalu bangunan. */
function terapkanGolongan(kode) {
  if (!kode || kode.split(".").length < 3) return kode;
  return kode.replace(/^([^.]*\.[^.]*\.)[^.]*/, "$1010306");
}

/** Segmen ke-4: 2 digit UPT + 3 digit nomor D.I. Lihat migrasi 0016. */
function segmenWilayah(uptId, kodeDi) {
  const nomor = Number(String(kodeDi).slice(-4));
  return `${String(uptId).padStart(2, "0")}${String(nomor).padStart(3, "0")}`;
}

/**
 * Memasang segmen wilayah, dengan pengecualian yang sama seperti aplikasi.
 *
 * Nomor DIBIARKAN apa adanya bila D.I.-nya tidak diketahui, bukan 6 segmen,
 * atau segmen ke-4-nya lebih dari 5 digit. Pada satu bendung (BNDG.0484)
 * segmen ke-4 dan ke-5 tertulis menyatu di buku; menimpanya akan ikut
 * memusnahkan segmen ke-5. Baris seperti itu memang sudah bertanda
 * `perlu_tinjau` dan harus diperiksa manusia, bukan ditebak skrip.
 */
function terapkanWilayah(kode, di) {
  if (!kode || !di) return kode;
  const bagian = kode.split(".");
  if (bagian.length !== 6 || bagian[3].length > 5) return kode;
  bagian[3] = segmenWilayah(di.upt_id, di.kode);
  return bagian.join(".");
}

/** Membakukan nama D.I. untuk dibandingkan; sama dengan `nama_di_baku()` di DB. */
function namaDiBaku(nama) {
  return (nama ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^DI/, "");
}

const teks = (v) => (v === null || v === undefined ? "" : String(v).trim());
const kosongJadiNull = (v) => (teks(v) === "" ? null : teks(v));

/* ------------------------------------------------------------------ jalan */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib ada di .env.local.");
  process.exit(1);
}
const sb = createClient(url, secret, { auth: { persistSession: false } });

/** Mengambil seluruh baris sebuah tabel; PostgREST membatasi 1.000 per permintaan. */
async function semua(tabel, kolom, saring) {
  const out = [];
  for (let dari = 0; ; dari += 1000) {
    let q = sb.from(tabel).select(kolom);
    if (saring) q = saring(q);
    const { data, error } = await q.order("id", { ascending: true }).range(dari, dari + 999);
    if (error) throw new Error(`${tabel}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const daftarDi = await semua("daerah_irigasi", "id, kode, upt_id, nama");
const petaDi = new Map(daftarDi.map((d) => [d.id, d]));

const asetLama = await semua("aset", "*", (q) => q.eq("jenis", "bendung"));

const draf = [];
for (let dari = 0; ; dari += 1000) {
  const { data, error } = await sb
    .from("aset_draf")
    .select("baris_ke, di_id, data")
    .eq("jenis", "bendung_baru")
    .order("baris_ke", { ascending: true })
    .range(dari, dari + 999);
  if (error) throw new Error(`aset_draf: ${error.message}`);
  draf.push(...data);
  if (data.length < 1000) break;
}

if (draf.length === 0) {
  console.error("Draf `bendung_baru` kosong. Jalankan `npm run impor-bendung-baru` dulu.");
  process.exit(1);
}

/**
 * Penanda asal pada `catatan` bendung yang disisipkan skrip ini.
 *
 * Ke-26 bendung itu tidak punya nomenklatur maupun nomor buku, jadi tidak ada
 * kunci alami untuk mengenalinya kembali. Tanpa penanda ini, menjalankan skrip
 * dua kali akan menyisipkan 26 baris kembar. Nama lapangannya unik di berkas
 * GIS, jadi cukup untuk dipakai sebagai kunci.
 */
const penandaAsal = (nama) => `Dari ${nama} pada berkas GIS SDY bendung Kab.dbf.`;

const petaNomenklatur = new Map();
const petaSisipan = new Map();
for (const a of asetLama) {
  if (a.nomenklatur) petaNomenklatur.set(a.nomenklatur, a);
  else if (a.catatan) petaSisipan.set(a.catatan, a);
}

/*
 * Nomor urut objek (segmen ke-5) yang sudah terpakai per D.I.
 *
 * Bendung baru yang belum punya nomor buku harus mendapat nomor urut yang
 * belum dipakai di D.I.-nya, supaya nomor asetnya tidak menabrak bendung yang
 * sudah ada di sana.
 */
const urutTerpakai = new Map();
for (const a of asetLama) {
  const bagian = (a.kode ?? "").split(".");
  if (!a.di_id || bagian.length !== 6) continue;
  const set = urutTerpakai.get(a.di_id) ?? urutTerpakai.set(a.di_id, new Set()).get(a.di_id);
  set.add(bagian[4]);
}

const perbarui = [];
const sisip = [];
/** Bendung hasil sisipan jalan sebelumnya; diperbarui, bukan disisipkan lagi. */
const perbaruiSisipan = [];
const dipakaiNum = new Set();

for (const d of draf) {
  const isi = d.data;
  const num = teks(isi.NUM);
  const di = d.di_id ? (petaDi.get(d.di_id) ?? null) : null;

  // Kolom dari berkas GIS yang menggantikan isi lama.
  const dariGis = {
    // 26 bendung yang tidak ada di Buku Aset tidak punya `type_bdgng` maupun
    // nomenklatur. Tanpa cadangan ini, seluruhnya tampil sebagai "Bendung" dan
    // tidak bisa dibedakan satu sama lain di daftar aset. Nama lapangannya di
    // kolom `Keterangan` jauh lebih berguna. Ke-558 baris lainnya tidak
    // terpengaruh: `type_bdgng`-nya terisi semua.
    nama: kosongJadiNull(isi.type_bdgng) ?? kosongJadiNull(isi.Keterangan) ?? "Bendung",
    di_id: di?.id ?? null,
    kode_di_buku: di ? String(Number(String(di.kode).slice(-4))).padStart(4, "0") : null,
    nama_di_buku: kosongJadiNull(isi.LAYER),
    desa: kosongJadiNull(isi.DESA),
    kecamatan: kosongJadiNull(isi.KECAMATAN),
  };

  const lama = num ? petaNomenklatur.get(num) : null;

  if (lama) {
    dipakaiNum.add(num);

    // Nomor buku tidak pernah diubah: itu asal-usulnya. Nomor SIKSI dihitung
    // ulang dari nomor buku memakai D.I. yang baru, jadi segmen wilayahnya
    // ikut terkoreksi bila tautannya berubah.
    const kode = terapkanWilayah(terapkanGolongan(lama.kode_buku ?? lama.kode), di);

    const beda = {};
    for (const [k, v] of Object.entries(dariGis)) {
      if (teks(lama[k]) !== teks(v)) beda[k] = { dari: lama[k], jadi: v };
    }
    if (teks(lama.kode) !== teks(kode)) beda.kode = { dari: lama.kode, jadi: kode };

    // `perlu_tinjau` dihitung ulang, bukan diwarisi: sebagian besar alasannya
    // adalah D.I. yang tidak terbaca dari nomor buku, dan berkas GIS justru
    // menjawab itu. Alasan yang masih berlaku tetap dipasang lagi di bawah.
    let alasan = null;
    if (!di) alasan = "D.I. tidak dikenali dari berkas GIS";
    else if ((kode ?? "").split(".").length !== 6) alasan = "format nomor aset tidak baku";
    else if (
      dariGis.nama_di_buku &&
      namaDiBaku(dariGis.nama_di_buku) !== namaDiBaku(di.nama) &&
      !namaDiBaku(dariGis.nama_di_buku).includes(namaDiBaku(di.nama)) &&
      !namaDiBaku(di.nama).includes(namaDiBaku(dariGis.nama_di_buku))
    ) {
      alasan = "nama D.I. di berkas GIS berbeda dari D.I. tautannya";
    }

    if (teks(lama.alasan_tinjau) !== teks(alasan)) {
      beda.alasan_tinjau = { dari: lama.alasan_tinjau, jadi: alasan };
    }

    perbarui.push({
      id: lama.id,
      nomenklatur: num,
      barisDraf: d.baris_ke,
      beda,
      muatan: { ...dariGis, kode, perlu_tinjau: alasan !== null, alasan_tinjau: alasan },
    });
  } else {
    /*
     * Bendung yang tidak ada di Buku Aset: 26 baris tanpa `NUM`.
     *
     * Nomor asetnya DIBENTUK, bukan disalin: kolom `Nomor.Bang` di berkas GIS
     * seluruhnya berisi nomor contekan yang sama, jadi tidak bisa dipakai.
     * Karena itu barisnya ditandai `perlu_tinjau` — nomor urutnya berasal dari
     * skrip ini, bukan dari Dinas.
     */
    const catatan = penandaAsal(teks(isi.Keterangan));
    const sudahAda = petaSisipan.get(catatan) ?? null;

    /*
     * Nomor urutnya hanya dibentuk sekali. Pada jalan berikutnya baris yang
     * sama dikenali lewat penanda asalnya dan nomornya dipakai lagi apa adanya,
     * supaya menjalankan skrip dua kali tidak menggeser nomor aset yang sudah
     * terlanjur dipakai di lapangan.
     */
    let kode = sudahAda?.kode ?? null;
    if (!kode && di) {
      const set = urutTerpakai.get(di.id) ?? urutTerpakai.set(di.id, new Set()).get(di.id);
      let n = 1;
      while (set.has(`01${String(n).padStart(3, "0")}`)) n += 1;
      const urut = `01${String(n).padStart(3, "0")}`;
      set.add(urut);
      // Segmen ke-6 mengikuti kebiasaan buku, yang menulis 2002 pada seluruh
      // aset. Bukan tahun pembangunan sungguhan, jadi kolom `tahun` dibiarkan
      // kosong daripada diisi angka yang tidak berdasar.
      kode = `33.23.010306.${segmenWilayah(di.upt_id, di.kode)}.${urut}.2002`;
    }

    (sudahAda ? perbaruiSisipan : sisip).push({
      id: sudahAda?.id ?? null,
      nama: teks(isi.Keterangan) || dariGis.nama,
      barisDraf: d.baris_ke,
      kode,
      muatan: {
        jenis: "bendung",
        ...dariGis,
        // Bendung ini tidak ada di Buku Aset, jadi tidak punya nomenklatur
        // maupun nomor buku. Mengarang keduanya akan membuatnya tampak
        // seolah-olah bersumber dari buku.
        nomenklatur: null,
        kode,
        kode_buku: null,
        tahun: null,
        seksi_buku: "3.1",
        perlu_tinjau: true,
        alasan_tinjau: di
          ? "bendung baru dari berkas GIS; nomor urut dibentuk sistem, belum ada di Buku Aset"
          : "bendung baru dari berkas GIS; D.I. tidak dikenali dan belum bernomor aset",
        catatan,
      },
    });
  }
}

/*
 * Aset bendung yang tidak terwakili sama sekali oleh berkas GIS.
 *
 * Baris hasil sisipan jalan sebelumnya TIDAK termasuk di sini walau tidak
 * bernomenklatur: baris itu justru berasal dari berkas GIS. Tanpa pengecualian
 * ini, --hapus-sisa akan menghapus 26 bendung yang baru saja dimasukkan.
 */
const idTercocok = new Set(perbaruiSisipan.map((x) => x.id));
const sisa = asetLama.filter(
  (a) => !idTercocok.has(a.id) && (!a.nomenklatur || !dipakaiNum.has(a.nomenklatur)),
);

/* ------------------------------------------------------------------ laporan */

const berubah = perbarui.filter((p) => Object.keys(p.beda).length > 0);
const hitungKolom = {};
for (const p of berubah) {
  for (const k of Object.keys(p.beda)) hitungKolom[k] = (hitungKolom[k] ?? 0) + 1;
}

console.log("Rencana penggantian aset Bendung\n");
console.log(`  aset bendung sekarang      ${String(asetLama.length).padStart(4)}`);
console.log(`  baris draf Bendung Baru    ${String(draf.length).padStart(4)}`);
console.log("");
console.log(`  diperbarui di tempat       ${String(perbarui.length).padStart(4)}  (id tetap)`);
console.log(`    di antaranya benar-benar berubah  ${berubah.length}`);
console.log(`  disisipkan sebagai baru    ${String(sisip.length).padStart(4)}`);
console.log(`  sisipan lama diperbarui    ${String(perbaruiSisipan.length).padStart(4)}`);
console.log(
  `  tidak ada di berkas GIS    ${String(sisa.length).padStart(4)}  ` +
    `(${HAPUS_SISA ? "AKAN DIHAPUS" : "dipertahankan"})`,
);
console.log(
  `\n  jumlah bendung sesudahnya  ${String(perbarui.length + perbaruiSisipan.length + sisip.length + (HAPUS_SISA ? 0 : sisa.length)).padStart(4)}`,
);

console.log("\nKolom yang berubah pada baris yang diperbarui:");
for (const [k, n] of Object.entries(hitungKolom).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(18)} ${String(n).padStart(4)} baris`);
}

const contohKode = berubah.filter((p) => p.beda.kode).slice(0, 8);
if (contohKode.length) {
  console.log("\nContoh nomor aset yang berubah:");
  for (const p of contohKode) {
    console.log(`  ${p.nomenklatur}  ${p.beda.kode.dari}  ->  ${p.beda.kode.jadi}`);
  }
}

console.log(`\n${sisip.length} bendung baru yang akan disisipkan:`);
for (const s of sisip.slice(0, 30)) {
  console.log(`  ${(s.kode ?? "tanpa nomor").padEnd(30)} ${s.nama}`);
}

if (sisa.length) {
  console.log(`\n${sisa.length} aset bendung yang tidak ada di berkas GIS:`);
  for (const a of sisa) {
    console.log(
      `  ${teks(a.nomenklatur).padEnd(12)} ${teks(a.nama).padEnd(16)} ` +
        `D.I. ${a.di_id ?? "tidak tertaut"} | ${teks(a.kecamatan)}`,
    );
  }
}

if (HANYA_PERIKSA) {
  console.log("\n(--periksa: tidak ada yang ditulis ke database)\n");
  process.exit(0);
}

/* ------------------------------------------------------------------ tulis */

// Cadangan ditulis SEBELUM apa pun berubah. Operasi ini menyentuh seluruh
// bendung di register resmi, dan tanpa salinan ini tidak ada jalan kembali.
mkdirSync(resolve(process.cwd(), DIR_CADANGAN), { recursive: true });
const stempel = new Date().toISOString().replace(/[:.]/g, "-");
const berkasCadangan = resolve(process.cwd(), DIR_CADANGAN, `aset-bendung-${stempel}.json`);
writeFileSync(berkasCadangan, JSON.stringify(asetLama, null, 2), "utf8");
console.log(`\nCadangan ${asetLama.length} baris bendung: ${berkasCadangan}`);

console.log("\nMemperbarui baris yang cocok…");
let n = 0;
const PARALEL = 25;
for (let i = 0; i < perbarui.length; i += PARALEL) {
  const potongan = perbarui.slice(i, i + PARALEL);
  const hasil = await Promise.all(
    potongan.map((p) => sb.from("aset").update(p.muatan).eq("id", p.id)),
  );
  for (const [j, h] of hasil.entries()) {
    if (h.error) {
      console.error(`\nGagal memperbarui id ${potongan[j].id}: ${h.error.message}`);
      process.exit(1);
    }
  }
  n += potongan.length;
  process.stdout.write(`\r  ${n}/${perbarui.length}`);
}
console.log();

if (perbaruiSisipan.length) {
  console.log("\nMemperbarui bendung hasil sisipan sebelumnya…");
  for (let i = 0; i < perbaruiSisipan.length; i += PARALEL) {
    const potongan = perbaruiSisipan.slice(i, i + PARALEL);
    const hasil = await Promise.all(
      potongan.map((x) => sb.from("aset").update(x.muatan).eq("id", x.id)),
    );
    for (const [j, h] of hasil.entries()) {
      if (h.error) {
        console.error(`Gagal memperbarui id ${potongan[j].id}: ${h.error.message}`);
        process.exit(1);
      }
    }
  }
  console.log(`  ${perbaruiSisipan.length} baris diperbarui`);
}

if (sisip.length) {
  console.log("\nMenyisipkan bendung baru…");
  const { error } = await sb.from("aset").insert(sisip.map((s) => s.muatan));
  if (error) {
    console.error(`Gagal menyisipkan: ${error.message}`);
    process.exit(1);
  }
  console.log(`  ${sisip.length} baris disisipkan`);
}

if (HAPUS_SISA && sisa.length) {
  console.log("\nMenghapus aset yang tidak ada di berkas GIS…");
  const { error } = await sb
    .from("aset")
    .delete()
    .in(
      "id",
      sisa.map((a) => a.id),
    );
  if (error) {
    console.error(`Gagal menghapus: ${error.message}`);
    process.exit(1);
  }
  console.log(`  ${sisa.length} baris dihapus`);
}

const { count } = await sb
  .from("aset")
  .select("*", { count: "exact", head: true })
  .eq("jenis", "bendung");
console.log(`\n✓ Selesai. Register aset kini berisi ${count} bendung.\n`);
