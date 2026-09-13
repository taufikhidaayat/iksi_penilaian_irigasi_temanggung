import { describe, expect, it } from "vitest";

import fixture from "./__fixtures__/master-excel.json";
import { KATALOG_INDIKATOR } from "./catalog";
import {
  ANAK_BY_PARENT,
  INDIKATOR_INPUT,
  KOMPONEN_UTAMA,
  NODE_BY_KODE,
  bobotEfektif,
  hitungSkor,
  isRelevan,
  kategoriIksi,
  kategoriKondisi,
} from "./scoring";
import type { KantongLumpur, NilaiInput } from "./types";

const EPS = 1e-9;
const semuaSeratus = (): NilaiInput =>
  Object.fromEntries(INDIKATOR_INPUT.map((n) => [n.kode, 100]));

describe("katalog", () => {
  it("berisi 270 node dan 158 indikator input", () => {
    expect(KATALOG_INDIKATOR).toHaveLength(270);
    expect(INDIKATOR_INPUT).toHaveLength(158);
  });

  it("punya 6 komponen utama dengan bobot berjumlah 100", () => {
    expect(KOMPONEN_UTAMA.map((k) => k.nomor)).toEqual(["I", "II", "III", "IV", "V", "VI"]);
    for (const kl of ["ada", "tidak"] as const) {
      const total = KOMPONEN_UTAMA.reduce((a, k) => a + bobotEfektif(k, kl), 0);
      expect(total).toBeCloseTo(100, 10);
    }
  });

  it("tidak punya kode ganda", () => {
    expect(new Set(KATALOG_INDIKATOR.map((n) => n.kode)).size).toBe(270);
  });

  it("setiap node non-root punya induk yang ada, dan tiap node terjangkau dari root", () => {
    for (const n of KATALOG_INDIKATOR) {
      if (n.parent !== null) expect(NODE_BY_KODE.has(n.parent)).toBe(true);
    }
    const terjangkau = new Set<string>();
    const turun = (kode: string) => {
      terjangkau.add(kode);
      for (const a of ANAK_BY_PARENT.get(kode) ?? []) turun(a);
    };
    for (const k of KOMPONEN_UTAMA) turun(k.kode);
    expect(terjangkau.size).toBe(270);
  });

  it("setiap indikator input punya 4 deskriptor kondisi", () => {
    for (const n of INDIKATOR_INPUT) {
      expect(n.kondisi, n.kode).toBeDefined();
      expect(n.kondisi!.jelek, n.kode).toBeTruthy();
      expect(n.kondisi!.baikSekali, n.kode).toBeTruthy();
    }
  });

  it("bobot anak pada node weighted_children berjumlah 100", () => {
    for (const n of KATALOG_INDIKATOR) {
      if (n.agregasi !== "weighted_children") continue;
      const anak = (ANAK_BY_PARENT.get(n.kode) ?? []).map((k) => NODE_BY_KODE.get(k)!);
      for (const kl of ["ada", "tidak"] as const) {
        const j = anak.reduce((a, c) => a + bobotEfektif(c, kl), 0);
        expect(j, `${n.kode} (${kl})`).toBeCloseTo(100, 9);
      }
    }
  });
});

describe("hitungSkor — paritas dengan Excel master", () => {
  const kl = fixture.kantongLumpur as KantongLumpur;
  const hasil = hitungSkor(fixture.inputs as NilaiInput, kl);

  it("mereproduksi seluruh 270 nilai node dari Excel", () => {
    const beda: string[] = [];
    for (const [kode, harap] of Object.entries(fixture.expected)) {
      const dapat = hasil.nilai.get(kode);
      if (dapat === null || dapat === undefined || Math.abs(dapat - harap) > 1e-6) {
        beda.push(`${kode}: dapat=${dapat} excel=${harap}`);
      }
    }
    expect(beda).toEqual([]);
  });

  it("mereproduksi total IKSI Excel (99.946)", () => {
    expect(hasil.total).toBeCloseTo(fixture.totalExcel, 6);
  });

  it("mencatat seluruh indikator relevan sebagai terisi", () => {
    // Master memuat 158 nilai, tetapi pada skenario kantong lumpur "ada" indikator
    // "Fasilitas penguras berfungsi" (I.3.3-3.a.a-1.ii) berbobot 0 sehingga tidak
    // dihitung sebagai indikator yang perlu diisi.
    expect(hasil.totalIndikator).toBe(157);
    expect(hasil.terisi).toBe(157);
    expect(hasil.belumTerisi).toEqual([]);
  });
});

describe("bobot kantong lumpur", () => {
  it.each(["ada", "tidak"] as const)(
    "semua indikator = 100 menghasilkan total tepat 100 (kantong lumpur: %s)",
    (kl) => {
      const { total, komponen } = hitungSkor(semuaSeratus(), kl);
      expect(Math.abs(total - 100)).toBeLessThan(EPS);
      for (const k of komponen) expect(k.nilai).toBeCloseTo(k.bobot, 9);
    },
  );

  it("merealokasi bobot bendung ketika kantong lumpur tidak ada", () => {
    const bendung = NODE_BY_KODE.get("I.1.1-1")!;
    const pintu = NODE_BY_KODE.get("I.1.1-2")!;
    const kantong = NODE_BY_KODE.get("I.1.1-3")!;
    expect([bendung.bobotAda, bendung.bobotTidak]).toEqual([4, 5]);
    expect([pintu.bobotAda, pintu.bobotTidak]).toEqual([7, 8]);
    expect([kantong.bobotAda, kantong.bobotTidak]).toEqual([2, 0]);
    // Total Bangunan Utama tetap 13 pada kedua skenario.
    expect(bendung.bobotAda + pintu.bobotAda + kantong.bobotAda).toBe(13);
    expect(bendung.bobotTidak + pintu.bobotTidak + kantong.bobotTidak).toBe(13);
  });

  it("menandai sub-pohon kantong lumpur tidak relevan saat tidak ada", () => {
    const kantongLeaf = INDIKATOR_INPUT.filter((n) => n.kode.startsWith("I.1.1-3."));
    expect(kantongLeaf.length).toBeGreaterThan(0);
    for (const n of kantongLeaf) {
      expect(isRelevan(n, "ada"), n.kode).toBe(true);
      expect(isRelevan(n, "tidak"), n.kode).toBe(false);
    }
    // "Fasilitas penguras berfungsi" justru sebaliknya: aktif hanya bila TIDAK ada.
    const penguras = NODE_BY_KODE.get("I.3.3-3.a.a-1.ii")!;
    expect(penguras.bobotAda).toBe(0);
    expect(penguras.bobotTidak).toBe(10);
    expect(isRelevan(penguras, "ada")).toBe(false);
    expect(isRelevan(penguras, "tidak")).toBe(true);
  });
});

describe("hitungSkor — pengisian sebagian", () => {
  it("mengembalikan null untuk sub-pohon tanpa input sama sekali", () => {
    const { nilai, total } = hitungSkor({ "I.1.1-1.a.i": 100 }, "ada");
    expect(nilai.get("I.1.1-1.a")).toBeCloseTo(0.8 * (60 / 100), 9);
    expect(nilai.get("II")).toBeNull();
    expect(total).toBeGreaterThan(0);
  });

  it("membedakan nilai 0 dari belum diisi", () => {
    const nol = hitungSkor({ "I.1.1-1.a.i": 0 }, "ada");
    const kosong = hitungSkor({}, "ada");
    expect(nol.nilai.get("I.1.1-1.a")).toBe(0);
    expect(kosong.nilai.get("I.1.1-1.a")).toBeNull();
    expect(nol.terisi).toBe(1);
    expect(kosong.terisi).toBe(0);
  });

  it("menghitung jumlah indikator relevan per skenario", () => {
    expect(hitungSkor({}, "ada").totalIndikator).toBe(
      INDIKATOR_INPUT.filter((n) => isRelevan(n, "ada")).length,
    );
    expect(hitungSkor({}, "tidak").totalIndikator).toBeLessThan(
      hitungSkor({}, "ada").totalIndikator,
    );
  });
});

describe("kategori", () => {
  it.each([
    [100, "SANGAT_BAIK"],
    [80, "SANGAT_BAIK"],
    [79.99, "BAIK"],
    [70, "BAIK"],
    [69.99, "KURANG"],
    [55, "KURANG"],
    [54.99, "JELEK"],
    [0, "JELEK"],
  ])("IKSI %s -> %s", (nilai, harap) => {
    expect(kategoriIksi(nilai as number)).toBe(harap);
  });

  it.each([
    [100, "BAIK_SEKALI"],
    [90, "BAIK_SEKALI"],
    [89, "BAIK"],
    [80, "BAIK"],
    [79, "SEDANG"],
    [60, "SEDANG"],
    [59, "JELEK"],
    [0, "JELEK"],
  ])("kondisi %s -> %s", (nilai, harap) => {
    expect(kategoriKondisi(nilai as number)).toBe(harap);
  });
});
