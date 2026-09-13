/**
 * Mesin perhitungan IKSI.
 *
 * Replikasi persis formula kolom H sheet "Form Penilaian".
 * Diverifikasi 0-mismatch terhadap seluruh 270 nilai cache Excel, dan kedua
 * skenario kantong lumpur menghasilkan total tepat 100.000000 saat semua
 * indikator bernilai 100. Lihat `scoring.test.ts`.
 */
import { KATALOG_INDIKATOR } from "./catalog";
import type {
  IndikatorNode,
  KantongLumpur,
  KategoriIksi,
  KategoriKondisi,
  NilaiInput,
} from "./types";

export const NODE_BY_KODE: ReadonlyMap<string, IndikatorNode> = new Map(
  KATALOG_INDIKATOR.map((n) => [n.kode, n]),
);

/** Kode anak per induk, terurut sesuai Excel. `null` = 6 komponen utama. */
export const ANAK_BY_PARENT: ReadonlyMap<string | null, readonly string[]> = (() => {
  const m = new Map<string | null, string[]>();
  for (const n of KATALOG_INDIKATOR) {
    const arr = m.get(n.parent);
    if (arr) arr.push(n.kode);
    else m.set(n.parent, [n.kode]);
  }
  return m;
})();

/** Enam komponen utama I..VI, terurut. */
export const KOMPONEN_UTAMA: readonly IndikatorNode[] = (
  ANAK_BY_PARENT.get(null) ?? []
).map((k) => NODE_BY_KODE.get(k)!);

/** Seluruh indikator yang butuh input (158 buah). */
export const INDIKATOR_INPUT: readonly IndikatorNode[] = KATALOG_INDIKATOR.filter(
  (n) => n.agregasi === "leaf",
);

/** Bobot efektif node, bergantung ada/tidaknya kantong lumpur pada D.I. */
export function bobotEfektif(node: IndikatorNode, kl: KantongLumpur): number {
  return kl === "ada" ? node.bobotAda : node.bobotTidak;
}

/**
 * Apakah node relevan untuk D.I. ini — yaitu masih bisa menyumbang nilai.
 *
 * Bobot 0 bisa muncul pada node itu sendiri ATAU pada salah satu induknya.
 * Contoh: leaf "Retakan" di bawah "Bangunan kantong lumpur" berbobot 100
 * (relatif terhadap induknya), tetapi induknya berbobot 0 saat kantong lumpur
 * tidak ada — sehingga leaf tersebut tidak boleh ikut dinilai. Karena itu
 * pemeriksaan harus menelusuri seluruh rantai induk, bukan node itu saja.
 */
export function isRelevan(node: IndikatorNode, kl: KantongLumpur): boolean {
  let cur: IndikatorNode | undefined = node;
  while (cur) {
    if (bobotEfektif(cur, kl) === 0) return false;
    cur = cur.parent ? NODE_BY_KODE.get(cur.parent) : undefined;
  }
  return true;
}

export interface HasilSkor {
  /** Nilai tiap node (kode -> nilai), `null` bila belum ada input sama sekali. */
  nilai: ReadonlyMap<string, number | null>;
  /** Total IKSI 0..100. */
  total: number;
  /** Nilai per komponen utama I..VI. */
  komponen: { kode: string; nomor: string; label: string; bobot: number; nilai: number }[];
  /** Jumlah indikator relevan yang sudah terisi. */
  terisi: number;
  /** Jumlah indikator relevan seluruhnya. */
  totalIndikator: number;
  /** Kode indikator relevan yang masih kosong. */
  belumTerisi: string[];
}

/**
 * Hitung seluruh pohon.
 *
 * Node tanpa satu pun input pada sub-pohonnya bernilai `null` (padanan `""`
 * di Excel), sehingga bukan 0 — membedakan "belum dinilai" dari "nilai nol".
 */
export function hitungSkor(nilaiInput: NilaiInput, kl: KantongLumpur): HasilSkor {
  const nilai = new Map<string, number | null>();

  const go = (kode: string): number | null => {
    const node = NODE_BY_KODE.get(kode)!;
    let hasil: number | null;

    if (node.agregasi === "leaf") {
      const v = nilaiInput[kode];
      hasil = v === null || v === undefined ? null : (bobotEfektif(node, kl) * v) / 100;
    } else {
      const anak = ANAK_BY_PARENT.get(kode) ?? [];
      const hidup = anak.map(go).filter((x): x is number => x !== null);
      if (hidup.length === 0) {
        hasil = null;
      } else {
        const jumlah = hidup.reduce((a, b) => a + b, 0);
        hasil =
          node.agregasi === "sum_children"
            ? jumlah
            : node.agregasi === "sum_children_div100"
              ? jumlah / 100
              : (bobotEfektif(node, kl) * jumlah) / 100;
      }
    }
    nilai.set(kode, hasil);
    return hasil;
  };

  for (const k of KOMPONEN_UTAMA) go(k.kode);

  const komponen = KOMPONEN_UTAMA.map((k) => ({
    kode: k.kode,
    nomor: k.nomor,
    label: k.label,
    bobot: bobotEfektif(k, kl),
    nilai: nilai.get(k.kode) ?? 0,
  }));

  const relevan = INDIKATOR_INPUT.filter((n) => isRelevan(n, kl));
  const belumTerisi = relevan
    .filter((n) => nilaiInput[n.kode] === null || nilaiInput[n.kode] === undefined)
    .map((n) => n.kode);

  return {
    nilai,
    total: komponen.reduce((a, k) => a + k.nilai, 0),
    komponen,
    terisi: relevan.length - belumTerisi.length,
    totalIndikator: relevan.length,
    belumTerisi,
  };
}

/* ------------------------------------------------------------------ */
/* Kategori                                                            */
/* ------------------------------------------------------------------ */

/**
 * Kategori kinerja IKSI keseluruhan.
 * Catatan no. 3 template rekap (Permen PUPR 12/PRT/M/2015):
 *   80-100% Sangat Baik · 70-79% Baik · 55-69% Kurang · <55% Jelek
 */
export function kategoriIksi(total: number): KategoriIksi {
  if (total >= 80) return "SANGAT_BAIK";
  if (total >= 70) return "BAIK";
  if (total >= 55) return "KURANG";
  return "JELEK";
}

export const INFO_KATEGORI_IKSI: Record<
  KategoriIksi,
  { label: string; singkat: string; rentang: string; tindakan: string; warna: string }
> = {
  SANGAT_BAIK: {
    label: "Kinerja Sangat Baik",
    singkat: "Sangat Baik",
    rentang: "80% – 100%",
    tindakan: "Pertahankan kondisi.",
    warna: "emerald",
  },
  BAIK: {
    label: "Kinerja Baik",
    singkat: "Baik",
    rentang: "70% – 79%",
    tindakan: "Pemeliharaan rutin.",
    warna: "sky",
  },
  KURANG: {
    label: "Kinerja Kurang",
    singkat: "Kurang",
    rentang: "55% – 69%",
    tindakan: "Perlu perhatian.",
    warna: "amber",
  },
  JELEK: {
    label: "Kinerja Jelek",
    singkat: "Jelek",
    rentang: "< 55%",
    tindakan: "Perlu segera penanganan.",
    warna: "rose",
  },
};

/**
 * Kategori kondisi untuk satu indikator, dari nilai 0..100.
 * Header kolom I..L "Form Penilaian":
 *   <60 Jelek · 60-79 Sedang · 80-89 Baik · 90-100 Baik Sekali
 */
export function kategoriKondisi(nilai: number): KategoriKondisi {
  if (nilai >= 90) return "BAIK_SEKALI";
  if (nilai >= 80) return "BAIK";
  if (nilai >= 60) return "SEDANG";
  return "JELEK";
}

export const INFO_KATEGORI_KONDISI: Record<
  KategoriKondisi,
  { label: string; rentang: string; min: number; max: number; warna: string }
> = {
  JELEK: { label: "Jelek", rentang: "< 60%", min: 0, max: 59, warna: "rose" },
  SEDANG: { label: "Sedang", rentang: "60 – 79%", min: 60, max: 79, warna: "amber" },
  BAIK: { label: "Baik", rentang: "80 – 89%", min: 80, max: 89, warna: "sky" },
  BAIK_SEKALI: { label: "Baik Sekali", rentang: "90 – 100%", min: 90, max: 100, warna: "emerald" },
};
