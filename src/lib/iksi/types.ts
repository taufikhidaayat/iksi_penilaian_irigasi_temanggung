/** Model domain IKSI (Indeks Kinerja Sistem Irigasi) — Permen PUPR No. 12/PRT/M/2015. */

/**
 * Cara sebuah node menurunkan nilainya dari anak-anaknya.
 * Dipetakan 1:1 dari bentuk formula kolom H pada sheet "Form Penilaian".
 */
export type Agregasi =
  /** Indikator input. nilai = bobot * input / 100  (input 0..100). */
  | "leaf"
  /** nilai = bobot * SUM(anak) / 100 — bobot anak berjumlah 100. */
  | "weighted_children"
  /** nilai = SUM(anak) — anak sudah membawa bobot absolut. */
  | "sum_children"
  /** nilai = SUM(anak) / 100 — bobot anak berjumlah 100 * bobot induk. Hanya VI.3. */
  | "sum_children_div100";

/** Empat deskriptor kondisi yang memandu penilai memilih angka 0..100. */
export interface DeskriptorKondisi {
  /** < 60% */
  jelek: string | null;
  /** 60 - 79% */
  sedang: string | null;
  /** 80 - 89% */
  baik: string | null;
  /** 90 - 100% */
  baikSekali: string | null;
}

export interface IndikatorNode {
  /** Kode hierarkis unik, mis. "I.1.1.1.a.i". Dipakai sebagai kunci nilai. */
  kode: string;
  /** Nomor tampil sesuai Excel, mis. "i", "a", "1.1", "I". */
  nomor: string;
  /** 1..6 */
  level: number;
  /** Urutan tampil global (pre-order, mengikuti urutan baris Excel). */
  urutan: number;
  /** Kode induk, null untuk 6 komponen utama. */
  parent: string | null;
  label: string;
  /** Bobot bila D.I. PUNYA kantong lumpur. */
  bobotAda: number;
  /** Bobot bila D.I. TIDAK punya kantong lumpur. */
  bobotTidak: number;
  /** Bobot apa adanya dari Excel, mis. "4/5*" — untuk ditampilkan. */
  bobotLabel: string;
  agregasi: Agregasi;
  /** Hanya ada pada node `leaf`. */
  kondisi?: DeskriptorKondisi;
  /** Catatan/keterangan dari kolom M Excel. */
  catatan?: string;
}

/** Kategori kinerja IKSI keseluruhan (catatan no. 3 pada template rekap). */
export type KategoriIksi = "SANGAT_BAIK" | "BAIK" | "KURANG" | "JELEK";

/** Kategori kondisi per indikator (header kolom I..L pada Form Penilaian). */
export type KategoriKondisi = "JELEK" | "SEDANG" | "BAIK" | "BAIK_SEKALI";

export type KantongLumpur = "ada" | "tidak";

/** Peta kode indikator -> nilai 0..100. Kode yang belum dinilai tidak hadir. */
export type NilaiInput = Record<string, number | null | undefined>;
