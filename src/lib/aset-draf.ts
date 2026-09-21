import type { JenisAset } from "@/lib/supabase/types";

/**
 * Data Aset Draf IKSI — hasil pendataan lapangan berbasis GIS.
 *
 * Delapan berkas di `data/aset-draf/`, satu per jenis aset; tujuh .xlsx dan
 * satu .dbf. Berbeda dari menu Aset Irigasi yang bersumber dari Buku Aset, draf
 * ini belum terverifikasi dan SENGAJA tidak bertahun: dipakai sebagai bahan
 * pembanding, bukan sumber resmi. Karena itu hanya admin yang bisa membukanya.
 */

/** Urutan kartu pada halaman daftar; mengikuti penomoran berkas drafnya. */
export const JENIS_DRAF: JenisAset[] = [
  // Kartu "Bendung" dari 01.BENDUNG.xlsx DIHAPUS: Dinas memakai berkas GIS
  // `SDY bendung Kab.dbf` sebagai gantinya. Berkas .xlsx-nya tetap disimpan di
  // data/aset-draf/ sebagai rujukan bila kelak perlu dibandingkan lagi.
  "bendung_baru",
  "saluran",
  "sadap",
  "saluran_pelimpah",
  "terjunan",
  "talang",
  "gorong_gorong",
  "tanah_saluran",
];

export function adalahJenisDraf(nilai: string): nilai is JenisAset {
  return (JENIS_DRAF as string[]).includes(nilai);
}

/**
 * Kunci jenis dipakai apa adanya di URL (`/aset-draf/gorong_gorong`).
 *
 * Garis bawah memang kurang rapi untuk sebuah alamat, tetapi memakai tanda
 * hubung berarti memetakan bolak-balik di setiap tautan, route handler, dan
 * tombol ekspor — satu tempat lagi yang bisa tidak sinkron tanpa ketahuan.
 */
export const KUNCI_URL = (jenis: JenisAset): string => jenis;

/** Nama berkas unduhan hasil ekspor, mis. `Draf-IKSI-Bendung.xlsx`. */
export function namaBerkasDraf(label: string): string {
  const bersih = label.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  return `Draf-IKSI-${bersih}.xlsx`;
}

/**
 * Nilai sel draf jadi teks untuk ditampilkan di tabel.
 *
 * Angka koordinat dari GIS punya belasan angka di belakang koma
 * (`110.073664002`), yang membuat kolom melebar tanpa menambah makna. Angka
 * pecahan dipangkas ke enam angka, sudah lebih dari cukup untuk derajat.
 */
export function selDraf(nilai: string | number | boolean | null | undefined): string {
  if (nilai === null || nilai === undefined) return "";
  if (typeof nilai === "boolean") return nilai ? "Ya" : "Tidak";
  if (typeof nilai === "number") {
    return Number.isInteger(nilai) ? String(nilai) : String(Number(nilai.toFixed(6)));
  }
  return nilai;
}

/**
 * Kolom identitas yang dicari kotak "Cari" tiap jenis draf.
 *
 * Disamakan perilakunya dengan menu Aset Irigasi, yang menyasar tujuh kolom
 * identitas saja. Sebelumnya menu ini mencari ke SELURUH kolom lewat
 * `teks_cari`, sehingga "Pasangan Batu" mengembalikan 448 baris dan "Ogee" 39,
 * padahal kata yang sama nihil di menu Aset Irigasi. Petugas yang terbiasa
 * dengan satu menu jadi mendapat jawaban berbeda di menu lainnya.
 *
 * Padanannya per kolom:
 *
 *     Aset Irigasi        Draf
 *     nomenklatur    ->   NUM / nomenk / noment
 *     nama           ->   Keterangan / Nama_sal / NAMA_SALUR
 *     nama_di_buku   ->   LAYER / NAME / NAMA DI
 *     desa           ->   DESA        (hanya yang punya)
 *     kecamatan      ->   KECAMATAN   (hanya yang punya)
 *     kode           ->   kolom tabel `kode`
 *     kode_buku      ->   kolom tabel `kode_draf`
 *
 * Nama kolomnya diambil apa adanya dari judul kolom berkas sumber, termasuk
 * singkatan yang ganjil seperti `noment` dan `NAMA_SALUR`.
 */
export const KOLOM_CARI: Partial<Record<JenisAset, string[]>> = {
  bendung_baru: ["LAYER", "Keterangan", "NUM", "DESA", "KECAMATAN"],
  saluran: ["NAME", "Nama_sal", "NUM"],
  sadap: ["LAYER", "Keterangan", "nomenk", "NUM"],
  saluran_pelimpah: ["LAYER", "Keterangan", "nomenk", "NUM"],
  terjunan: ["LAYER", "Keterangan", "NUM"],
  talang: ["LAYER", "Keterangan", "noment", "NUM"],
  gorong_gorong: ["LAYER", "Keterangan", "NUM"],
  tanah_saluran: ["NAMA DI", "NAMA_SALUR", "DESA", "KECAMATAN"],
};

/**
 * Jenis yang nomor asetnya di berkas sumber TIDAK ikut dicari.
 *
 * Berkas GIS Bendung Baru belum digarap nomor asetnya: 556 dari 584 baris
 * memuat nomor contekan yang sama persis, `33.23.010306.0001.01001.2002`.
 * Selama `kode_draf` ikut dicari, mengetik "0001" mengembalikan 556 baris yang
 * tidak ada hubungannya dengan D.I. 1, sementara di menu Aset Irigasi kata
 * kunci itu menunjuk D.I. 1 saja. Nomornya baru boleh ikut dicari setelah
 * Dinas memperbaiki berkasnya.
 */
export const KODE_DRAF_TAK_DICARI: JenisAset[] = ["bendung_baru"];

/**
 * Kolom yang memuat nomor D.I. sebagai angka tersendiri.
 *
 * Menggantikan peran segmen ke-4 nomor buku bagi jenis yang nomornya tidak
 * bisa dipercaya. Petugas terbiasa mengetik kode D.I. 4 digit ("0001"), jadi
 * angka itu dicocokkan ke sini setelah angka nolnya di depan dibuang.
 */
export const KOLOM_NOMOR_DI: Partial<Record<JenisAset, string>> = {
  bendung_baru: "Nomer DI",
  tanah_saluran: "Nomer DI",
};

/** Kata kunci yang berupa kode D.I., mis. "0001", "538". Maksimal 4 digit. */
export const ADALAH_KODE_DI = (kata: string): boolean => /^\d{1,4}$/.test(kata);
