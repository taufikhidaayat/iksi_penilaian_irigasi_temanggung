/**
 * Potongan filter pencarian untuk PostgREST.
 *
 * Dipakai bersama oleh menu Aset Irigasi dan Aset Draf supaya keduanya
 * berperilaku sama persis: satu kotak cari, beberapa kolom identitas, cocok
 * di mana pun di dalam nilainya (ILIKE `%kata%`).
 */

/**
 * Nilai untuk filter `or()`, dikutip.
 *
 * Wajib dikutip. PostgREST memisahkan cabang `or()` dengan koma dan mengelompokkan
 * dengan kurung, jadi kata kunci yang memuat salah satunya akan dibaca sebagai
 * bagian dari sintaks filter, bukan sebagai teks yang dicari:
 *
 *   - `(MA)`           -> tanpa kutip hasilnya 0 baris, padahal ada 345
 *   - `Sirancah (MA)`  -> tanpa kutip hasilnya 0 baris, padahal ada 3
 *   - `a,b`            -> tanpa kutip permintaannya ditolak server
 *
 * Yang pertama dan kedua itu yang berbahaya: tidak ada galat, daftarnya sekadar
 * kosong, dan petugas menyimpulkan asetnya tidak ada. Padahal puluhan bendung
 * memang bernama "PMA ... (MA)".
 */
export function nilaiCari(kata: string): string {
  // Hanya `"` dan `\` yang perlu di-escape di dalam kutip PostgREST; sisanya,
  // termasuk koma dan kurung, aman begitu berada di dalam tanda kutip.
  return `"%${kata.replace(/["\\]/g, (c) => `\\${c}`)}%"`;
}

/**
 * Nama kolom untuk filter, dikutip bila perlu.
 *
 * Kolom draf berasal dari judul kolom berkas Excel/dBase apa adanya, jadi ada
 * yang memuat spasi (`NAMA DI`) atau titik (`Nomor.Bang`). Tanpa kutip,
 * PostgREST membaca titik sebagai pemisah operator.
 */
function namaKolom(kolom: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(kolom) ? kolom : `"${kolom}"`;
}

/** Satu kolom tabel biasa, mis. `kode.ilike."%abc%"`. */
export function cabangKolom(kolom: string, kata: string): string {
  return `${namaKolom(kolom)}.ilike.${nilaiCari(kata)}`;
}

/** Satu kunci di dalam kolom jsonb, mis. `data->>LAYER.ilike."%abc%"`. */
export function cabangJsonb(kolomJsonb: string, kunci: string, kata: string): string {
  return `${kolomJsonb}->>${namaKolom(kunci)}.ilike.${nilaiCari(kata)}`;
}

/**
 * Satu kunci jsonb yang harus cocok PERSIS, mis. `data->>"Nomer DI".eq."538"`.
 *
 * Dipakai untuk nomor D.I., yang disimpan sebagai angka. Kalau dicocokkan
 * sebagian seperti kolom teks, mengetik "1" akan menyapu D.I. 1, 11, 100, 151,
 * dan seterusnya, sehingga hasilnya tidak berguna.
 */
export function cabangJsonbSama(kolomJsonb: string, kunci: string, nilai: string): string {
  return `${kolomJsonb}->>${namaKolom(kunci)}.eq.${nilaiFilterPersis(nilai)}`;
}

/** Nilai persis untuk filter `or()`, dikutip dengan aturan yang sama. */
function nilaiFilterPersis(nilai: string): string {
  return `"${nilai.replace(/["\\]/g, (c) => `\\${c}`)}"`;
}
