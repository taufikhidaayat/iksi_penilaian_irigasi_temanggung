/**
 * Penilaian per bangunan untuk Komponen I (Prasarana Fisik).
 *
 * Blangko Permen PUPR 12/PRT/M/2015 memeriksa tiap bangunan satu per satu,
 * lalu merekapnya. Modul ini memetakan jenis aset ke kelompok indikator yang
 * berlaku baginya, lalu merata-ratakan hasilnya kembali menjadi `NilaiInput`
 * biasa yang siap disuap ke `hitungSkor()`.
 *
 * Mesin skoring tidak perlu tahu apa-apa soal ini. Rata-rata adalah operasi
 * linear, sehingga merata-ratakan tiap indikator lintas bangunan menghasilkan
 * angka yang IDENTIK dengan cara blangko (hitung nilai tiap bangunan dulu,
 * baru dirata-rata):
 *
 *     rata-rata( Σ bobotᵢ × nilaiᵢⱼ )  =  Σ bobotᵢ × rata-rata( nilaiᵢⱼ )
 *          j                                              j
 *
 * Kesetaraan itu dibuktikan ulang di `per-bangunan.test.ts` terhadap data acak.
 *
 * Modul ini MURNI: tidak mengimpor apa pun dari sisi server, sehingga boleh
 * dipakai komponen `"use client"`. Lihat gotcha no. 2 pada PROGRESS.md.
 */
import type { JenisAset } from "@/lib/supabase/types";

import { ANAK_BY_PARENT, NODE_BY_KODE, isRelevan } from "./scoring";
import type { IndikatorNode, KantongLumpur, NilaiInput } from "./types";

/**
 * Jenis aset -> kelompok indikator yang dinilai per unit.
 *
 * Nilainya adalah kode node induk; seluruh daun di bawahnya ikut. Jenis yang
 * tidak tercantum di sini tidak dinilai per unit sama sekali (seluruh aset
 * tanah, dan `jalan_inspeksi` yang indikatornya berupa prosentase se-jaringan).
 *
 * Yang SENGAJA tidak dipetakan, karena deskriptornya bicara program atau
 * jaringan dan bukan satu bangunan:
 *   I.2.2-3 Pelaksanaan, I.3.3-3.b Penyumbatan, I.3.3-4 Perbaikan Bangunan,
 *   seluruh I.4 Saluran Pembuang, I.5 Jalan, I.6 Kantor, dan Komponen II-VI.
 *
 * Yang tidak punya padanan aset di register:
 *   I.3.3-3.a.a-2 Jembatan, I.3.3-3.a.a-4 Tangga cucian.
 */
export const KELOMPOK_PER_JENIS: Partial<Record<JenisAset, readonly string[]>> = {
  bendung: [
    "I.1.1-1", // Bendung (21 daun)
    "I.1.1-2", // Pintu-pintu bendung (4)
    "I.1.1-3", // Kantong lumpur (5, hilang sendiri bila D.I. tidak punya)
    "I.3.3-2.a", // Pengukuran debit pada bangunan pengambilan (3)
  ],
  sadap: [
    "I.3.3-1.a", // Bangunan pengatur induk dan sekunder (6)
    "I.3.3-2.b", // Bangunan pengukur (3)
  ],
  saluran: [
    "I.2.2-1", // Kapasitas saluran (3)
    "I.2.2-2", // Tanggul (2)
  ],
  bangunan_pengaman: [
    "I.2.2-2", // Tanggul, menyatu dengan saluran
  ],
  talang: ["I.3.3-3.a.a-1"], // Syphon, gorong-gorong, talang, cross drain (7)
  gorong_gorong: ["I.3.3-3.a.a-1"],
  terjunan: ["I.3.3-3.a.a-3"], // Terjunan, pelimpah samping, drain inlet (4)
  saluran_pelimpah: ["I.3.3-3.a.a-3"],
};

/**
 * Seluruh sadap diperlakukan sebagai bangunan induk/sekunder.
 *
 * Diverifikasi ke 3.115 baris: semuanya bernomenklatur `SdpBg.S.####` dengan
 * segmen tingkat `S`, tanpa satu pun variasi. Register aset memang hanya
 * memuat jaringan induk dan sekunder, karena tersier adalah tanggung jawab
 * P3A dan bukan aset yang diinventarisasi pemerintah daerah.
 *
 * Karena itu I.3.3-1.b (Bangunan tersier) dan I.3.3-2.c (Sadap tersier) tidak
 * muncul di peta atas, dan tetap diisi manual seperti sebelumnya.
 *
 * BELUM PASTI: 515 dari 3.115 sadap bernama "CORONG"/"CORONGAN", yang di
 * lapangan lazimnya bangunan sadap tersier. Bila petugas membenarkan, pindahkan
 * aset-aset itu ke I.3.3-1.b dan I.3.3-2.c dengan menambahkan cabang pada
 * `kelompokUntukAset()` berdasarkan kolom `nama`. Tidak perlu kolom baru.
 */
export const CATATAN_TINGKAT_JARINGAN = "induk-sekunder" as const;

/** Daftar kode daun di bawah sebuah node, terurut sesuai Excel. */
function daunDiBawah(kode: string): string[] {
  const node = NODE_BY_KODE.get(kode);
  if (!node) return [];
  if (node.agregasi === "leaf") return [kode];
  return (ANAK_BY_PARENT.get(kode) ?? []).flatMap(daunDiBawah);
}

/** Daun tiap kelompok, dihitung sekali saat modul dimuat. */
const DAUN_KELOMPOK: ReadonlyMap<string, readonly string[]> = new Map(
  [...new Set(Object.values(KELOMPOK_PER_JENIS).flat())].map((k) => [k, daunDiBawah(k)]),
);

/** Jenis aset yang dinilai per unit. */
export const JENIS_PER_UNIT: readonly JenisAset[] = Object.keys(
  KELOMPOK_PER_JENIS,
) as JenisAset[];

/**
 * Kode node induk tiap kelompok per unit, mis. "I.3.3-1.a".
 *
 * Dipakai pohon indikator untuk mengganti seluruh sub-pohon dengan satu kartu
 * penunjuk, alih-alih merender kartu indikator yang tidak boleh diisi di situ.
 */
export const KODE_KELOMPOK_PER_UNIT: ReadonlySet<string> = new Set(DAUN_KELOMPOK.keys());

/** Jenis bangunan yang mengisi sebuah kelompok. Tanggul diisi dua jenis. */
export const JENIS_UNTUK_KELOMPOK: ReadonlyMap<string, readonly JenisAset[]> = (() => {
  const m = new Map<string, JenisAset[]>();
  for (const [jenis, kelompok] of Object.entries(KELOMPOK_PER_JENIS)) {
    for (const k of kelompok ?? []) {
      const arr = m.get(k);
      if (arr) arr.push(jenis as JenisAset);
      else m.set(k, [jenis as JenisAset]);
    }
  }
  return m;
})();

export function dinilaiPerUnit(jenis: JenisAset): boolean {
  return jenis in KELOMPOK_PER_JENIS;
}

/**
 * Seluruh kode indikator yang nilainya berasal dari rata-rata per bangunan,
 * bukan ketikan manual. **58 dari 158** indikator input.
 *
 * Yang benar-benar terisi tergantung toggle kantong lumpur: 57 saat kantong
 * lumpur ada (I.3.3-3.a.a-1.ii berbobot 0), 53 saat tidak ada (sub-pohon
 * kantong lumpur mati, tetapi I.3.3-3.a.a-1.ii justru hidup).
 *
 * Dipakai form untuk memutuskan sebuah daun dirender sebagai kartu biasa atau
 * sebagai tabel per bangunan.
 */
export const INDIKATOR_PER_UNIT: ReadonlySet<string> = new Set(
  [...DAUN_KELOMPOK.values()].flat(),
);

/** Satu kelompok indikator yang harus diisi untuk sebuah aset. */
export interface KelompokIndikator {
  /** Kode node induk kelompok, mis. "I.3.3-1.a". */
  kode: string;
  label: string;
  /** Daun yang harus diisi, sudah disaring menurut kantong lumpur. */
  daun: readonly IndikatorNode[];
}

/**
 * Kelompok indikator yang berlaku untuk sebuah aset.
 *
 * Kelompok yang seluruh daunnya tidak relevan (mis. kantong lumpur pada D.I.
 * yang tidak punya) tidak dikembalikan sama sekali, bukan dikembalikan kosong.
 */
export function kelompokUntukAset(
  jenis: JenisAset,
  kl: KantongLumpur,
): KelompokIndikator[] {
  const kelompok = KELOMPOK_PER_JENIS[jenis];
  if (!kelompok) return [];

  return kelompok
    .map((kode) => ({
      kode,
      label: NODE_BY_KODE.get(kode)?.label ?? kode,
      daun: (DAUN_KELOMPOK.get(kode) ?? [])
        .map((k) => NODE_BY_KODE.get(k)!)
        .filter((n) => isRelevan(n, kl)),
    }))
    .filter((k) => k.daun.length > 0);
}

/** Kode daun yang harus diisi untuk sebuah aset, diratakan jadi satu daftar. */
export function indikatorUntukAset(jenis: JenisAset, kl: KantongLumpur): string[] {
  return kelompokUntukAset(jenis, kl).flatMap((k) => k.daun.map((d) => d.kode));
}

/** Satu sel penilaian: satu indikator pada satu bangunan. */
export interface BarisNilaiAset {
  asetId: number;
  indikatorKode: string;
  nilai: number | null;
  /**
   * true bila nilainya datang dari pengisian massal, bukan diperiksa satuan.
   * Tidak berpengaruh pada hitungan, hanya pada kelengkapan yang dilaporkan
   * ke verifikator lewat `statistikPengisian()`.
   */
  massal?: boolean;
}

/**
 * Baris yang dipastikan punya nilai.
 *
 * Bentuk inilah yang dikirim ke server: indikator yang dikosongkan penilai
 * dihapus dari peta, bukan disimpan sebagai `null`.
 */
export type BarisNilaiAsetTerisi = Omit<BarisNilaiAset, "nilai"> & { nilai: number };

/**
 * Merata-ratakan nilai per bangunan menjadi satu angka per indikator.
 *
 * Bangunan yang belum dinilai DILEWATI, bukan dianggap 0. Membedakan "belum
 * dinilai" dari "kondisinya hancur" itu penting: menganggapnya 0 akan
 * menjatuhkan skor D.I. karena alasan administratif belaka.
 *
 * Indikator yang tidak punya satu pun nilai tidak muncul di hasil, sehingga
 * `hitungSkor()` membacanya sebagai `undefined` dan memperlakukannya sebagai
 * belum dinilai, persis seperti sel kosong di Excel.
 */
export function rataRataPerIndikator(baris: readonly BarisNilaiAset[]): NilaiInput {
  const jumlah = new Map<string, { total: number; n: number }>();

  for (const b of baris) {
    if (b.nilai === null || b.nilai === undefined) continue;
    const sel = jumlah.get(b.indikatorKode);
    if (sel) {
      sel.total += b.nilai;
      sel.n += 1;
    } else {
      jumlah.set(b.indikatorKode, { total: b.nilai, n: 1 });
    }
  }

  const hasil: Record<string, number> = {};
  for (const [kode, { total, n }] of jumlah) hasil[kode] = total / n;
  return hasil;
}

/**
 * Menggabungkan nilai agregat (ketikan manual) dengan hasil rata-rata per
 * bangunan, menghasilkan `NilaiInput` utuh untuk `hitungSkor()`.
 *
 * Rata-rata per bangunan MENANG untuk indikator yang dinilai per unit. Sisa
 * ketikan manual pada indikator itu diabaikan, supaya nilai basi dari sebelum
 * perubahan ini tidak diam-diam ikut terhitung.
 */
export function gabungNilai(
  agregat: NilaiInput,
  baris: readonly BarisNilaiAset[],
): NilaiInput {
  const hasil: NilaiInput = {};
  for (const [kode, nilai] of Object.entries(agregat)) {
    if (!INDIKATOR_PER_UNIT.has(kode)) hasil[kode] = nilai;
  }
  return { ...hasil, ...rataRataPerIndikator(baris) };
}

/** Kelengkapan pengisian satu kelompok bangunan, untuk ditampilkan di form. */
export interface StatistikJenis {
  jenis: JenisAset;
  /** Jumlah bangunan jenis ini pada D.I. */
  bangunan: number;
  /** Bangunan yang seluruh indikatornya sudah terisi. */
  lengkap: number;
  /** Bangunan yang baru terisi sebagian. */
  sebagian: number;
  /** Bangunan yang nilainya seluruhnya berasal dari pengisian massal. */
  massal: number;
}

/**
 * Menghitung kelengkapan per jenis bangunan.
 *
 * Angka `massal` sengaja dipisahkan: D.I. yang seluruh bangunannya diisi sekali
 * klik tidak boleh terlihat sama dengan yang diperiksa satu per satu, supaya
 * verifikator punya dasar menilai kelayakan pengajuan.
 */
export function statistikPengisian(
  aset: readonly { id: number; jenis: JenisAset }[],
  baris: readonly BarisNilaiAset[],
  kl: KantongLumpur,
): StatistikJenis[] {
  const perAset = new Map<number, { terisi: number; massal: number }>();
  for (const b of baris) {
    if (b.nilai === null || b.nilai === undefined) continue;
    const sel = perAset.get(b.asetId) ?? { terisi: 0, massal: 0 };
    sel.terisi += 1;
    if (b.massal) sel.massal += 1;
    perAset.set(b.asetId, sel);
  }

  const hasil = new Map<JenisAset, StatistikJenis>();
  for (const a of aset) {
    if (!dinilaiPerUnit(a.jenis)) continue;
    const perlu = indikatorUntukAset(a.jenis, kl).length;
    if (perlu === 0) continue;

    const s =
      hasil.get(a.jenis) ??
      { jenis: a.jenis, bangunan: 0, lengkap: 0, sebagian: 0, massal: 0 };
    s.bangunan += 1;

    const isi = perAset.get(a.id);
    if (isi) {
      if (isi.terisi >= perlu) s.lengkap += 1;
      else s.sebagian += 1;
      if (isi.massal === isi.terisi) s.massal += 1;
    }
    hasil.set(a.jenis, s);
  }

  return [...hasil.values()];
}
