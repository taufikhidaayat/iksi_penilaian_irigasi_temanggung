import type { NadaLencana } from "@/components/ui";
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
