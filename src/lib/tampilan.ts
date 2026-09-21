import type { NadaLencana } from "@/components/ui";
import { KOMPONEN_UTAMA } from "@/lib/iksi/scoring";
import type { KategoriIksi, KategoriKondisi } from "@/lib/iksi/types";
import type { StatusPenilaian } from "@/lib/supabase/types";

/** Pemetaan kategori kinerja IKSI ke nada lencana. */
export function nadaKategori(k: KategoriIksi): NadaLencana {
  return { SANGAT_BAIK: "hijau", BAIK: "biru", KURANG: "kuning", JELEK: "merah" }[k] as NadaLencana;
}

/** Pemetaan kategori kondisi indikator ke nada lencana. */
export function nadaKondisi(k: KategoriKondisi): NadaLencana {
  return { BAIK_SEKALI: "hijau", BAIK: "biru", SEDANG: "kuning", JELEK: "merah" }[
    k
  ] as NadaLencana;
}

export const INFO_STATUS: Record<
  StatusPenilaian,
  { label: string; nada: NadaLencana; keterangan: string }
> = {
  draft: {
    label: "Draft",
    nada: "netral",
    keterangan: "Masih bisa diubah oleh UPT.",
  },
  diajukan: {
    label: "Diajukan",
    nada: "biru",
    keterangan: "Menunggu verifikasi Administrator.",
  },
  disetujui: {
    label: "Disetujui",
    nada: "hijau",
    keterangan: "Terkunci dan masuk rekapitulasi.",
  },
  revisi: {
    label: "Perlu Revisi",
    nada: "kuning",
    keterangan: "Dikembalikan Administrator untuk diperbaiki.",
  },
};

/** Urutan tampil kategori kinerja, dari terbaik ke terburuk. */
export const URUTAN_KATEGORI: KategoriIksi[] = ["SANGAT_BAIK", "BAIK", "KURANG", "JELEK"];

/**
 * Warna heksadesimal kategori untuk Recharts.
 * Recharts butuh nilai warna literal, bukan kelas Tailwind — nilainya
 * disamakan dengan token --color-kat-* di globals.css.
 */
export function warnaKategori(k: KategoriIksi): string {
  return {
    SANGAT_BAIK: "#059669",
    BAIK: "#0284c7",
    KURANG: "#d97706",
    JELEK: "#e11d48",
  }[k];
}

/**
 * Bobot maksimum Komponen I, diambil dari katalog dan bukan ditulis tangan.
 *
 * Nilainya sama pada kedua skenario kantong lumpur (45), tetapi mengambilnya
 * dari katalog membuat kolom "setara 100%" ikut benar bila bobot komponen
 * berubah di kemudian hari.
 */
export const BOBOT_PRASARANA_FISIK =
  KOMPONEN_UTAMA.find((k) => k.kode === "I")?.bobotAda ?? 45;

/**
 * Mengubah nilai berbobot menjadi skala 0..100 miliknya sendiri.
 *
 * Skor Prasarana Fisik disimpan sebagai sumbangannya terhadap total, jadi
 * maksimumnya 45 dan bukan 100. Angka itu sulit dibaca sebagai "seberapa baik
 * prasarananya": 36 terdengar buruk padahal setara 80%. Fungsi ini hanya untuk
 * ditampilkan, tidak pernah ikut dijumlahkan ke total IKSI.
 */
export function setaraPersen(nilai: number | null, bobotMaks: number): number | null {
  if (nilai === null || nilai === undefined || bobotMaks <= 0) return null;
  return (nilai / bobotMaks) * 100;
}

/* ------------------------------------------------------------------ */
/* Pilihan bentuk daftar                                               */
/* ------------------------------------------------------------------ */

export type TampilanDaftar = "kartu" | "tabel";

/**
 * Nama cookie penyimpan pilihan tampilan daftar.
 *
 * Sengaja cookie dan bukan localStorage. Halaman daftar dirender di server,
 * jadi pilihan yang hanya diketahui browser membuat render pertama selalu
 * memakai bentuk default lalu berganti setelah hidrasi. Lewat cookie, server
 * sudah tahu bentuk yang benar sejak awal dan tidak ada kedipan.
 */
export const KUKI_TAMPILAN = "siksi-tampilan";

export function bacaTampilan(nilai: string | undefined): TampilanDaftar {
  return nilai === "tabel" ? "tabel" : "kartu";
}
