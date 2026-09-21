import { describe, expect, it } from "vitest";

import {
  CATATAN_TINGKAT_JARINGAN,
  INDIKATOR_PER_UNIT,
  JENIS_PER_UNIT,
  KELOMPOK_PER_JENIS,
  dinilaiPerUnit,
  gabungNilai,
  indikatorUntukAset,
  kelompokUntukAset,
  rataRataPerIndikator,
  statistikPengisian,
  type BarisNilaiAset,
} from "./per-bangunan";
import { INDIKATOR_INPUT, NODE_BY_KODE, hitungSkor } from "./scoring";
import type { JenisAset } from "@/lib/supabase/types";
import type { KantongLumpur } from "./types";

const EPS = 1e-9;

/** Acak yang bisa diulang, supaya kegagalan test bisa ditelusuri. */
function acak(benih: number): () => number {
  let s = benih >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe("pemetaan jenis aset", () => {
  it("memetakan 8 jenis bangunan, dan tidak satu pun aset tanah", () => {
    expect([...JENIS_PER_UNIT].sort()).toEqual(
      [
        "bangunan_pengaman",
        "bendung",
        "gorong_gorong",
        "sadap",
        "saluran",
        "saluran_pelimpah",
        "talang",
        "terjunan",
      ].sort(),
    );
    for (const j of JENIS_PER_UNIT) expect(j.startsWith("tanah_")).toBe(false);
    expect(dinilaiPerUnit("tanah_rumah")).toBe(false);
    expect(dinilaiPerUnit("jalan_inspeksi")).toBe(false);
  });

  it("menghasilkan jumlah indikator per unit sesuai rencana", () => {
    // [jenis, saat kantong lumpur ada, saat tidak]
    const harap: [JenisAset, number, number][] = [
      ["bendung", 33, 28],
      ["sadap", 9, 9],
      ["saluran", 5, 5],
      ["bangunan_pengaman", 2, 2],
      ["talang", 6, 7],
      ["gorong_gorong", 6, 7],
      ["terjunan", 4, 4],
      ["saluran_pelimpah", 4, 4],
    ];
    for (const [jenis, ada, tidak] of harap) {
      expect(indikatorUntukAset(jenis, "ada"), `${jenis} ada`).toHaveLength(ada);
      expect(indikatorUntukAset(jenis, "tidak"), `${jenis} tidak`).toHaveLength(tidak);
    }
  });

  it("menghitung 58 dari 158 indikator sebagai per unit", () => {
    // 58, bukan 67: rencana awal masih menghitung I.3.3-1.b dan I.3.3-2.c
    // (9 indikator tersier) yang kemudian dicoret karena tidak punya aset.
    expect(INDIKATOR_PER_UNIT.size).toBe(58);
    expect(INDIKATOR_INPUT).toHaveLength(158);
  });

  it("hanya memetakan node yang benar-benar daun", () => {
    for (const kode of INDIKATOR_PER_UNIT) {
      expect(NODE_BY_KODE.get(kode)?.agregasi, kode).toBe("leaf");
    }
  });

  it("hanya memetakan indikator Komponen I", () => {
    for (const kode of INDIKATOR_PER_UNIT) expect(kode.startsWith("I.")).toBe(true);
  });

  it("membiarkan indikator tersier tetap agregat, karena tidak punya aset padanan", () => {
    // Register aset hanya memuat jaringan induk dan sekunder: seluruh 3.115
    // sadap bernomenklatur SdpBg.S.####, tanpa satu pun variasi tingkat.
    expect(CATATAN_TINGKAT_JARINGAN).toBe("induk-sekunder");
    for (const kode of INDIKATOR_PER_UNIT) {
      expect(kode.startsWith("I.3.3-1.b"), kode).toBe(false);
      expect(kode.startsWith("I.3.3-2.c"), kode).toBe(false);
    }
  });

  it("tidak memetakan indikator yang berupa progres atau prosentase se-jaringan", () => {
    const agregatWajib = [
      "I.2.2-3", // Pelaksanaan
      "I.3.3-3.b", // Penyumbatan
      "I.3.3-4", // Perbaikan Bangunan
      "I.4", // Saluran Pembuang
      "I.5", // Jalan
      "I.6", // Kantor, perumahan, gudang
      "II",
      "III",
      "IV",
      "V",
      "VI",
    ];
    for (const kode of INDIKATOR_PER_UNIT) {
      for (const a of agregatWajib) {
        expect(kode === a || kode.startsWith(`${a}.`), `${kode} vs ${a}`).toBe(false);
      }
    }
  });

  it("berbagi kelompok Tanggul antara saluran dan bangunan pengaman", () => {
    expect(KELOMPOK_PER_JENIS.saluran).toContain("I.2.2-2");
    expect(KELOMPOK_PER_JENIS.bangunan_pengaman).toEqual(["I.2.2-2"]);
  });
});

describe("kantong lumpur", () => {
  it("mencopot kelompok kantong lumpur dari bendung saat D.I. tidak punya", () => {
    expect(indikatorUntukAset("bendung", "ada")).toHaveLength(33);
    expect(indikatorUntukAset("bendung", "tidak")).toHaveLength(28);

    const kodeTidak = indikatorUntukAset("bendung", "tidak");
    expect(kodeTidak.some((k) => k.startsWith("I.1.1-3"))).toBe(false);
  });

  it("tidak mengembalikan kelompok kosong, melainkan menghilangkannya", () => {
    const kelompok = kelompokUntukAset("bendung", "tidak");
    expect(kelompok.map((k) => k.kode)).toEqual(["I.1.1-1", "I.1.1-2", "I.3.3-2.a"]);
    for (const k of kelompok) expect(k.daun.length).toBeGreaterThan(0);
  });

  it("juga menggeser talang dan gorong-gorong, bukan cuma bendung", () => {
    // Jebakan yang diperingatkan PROGRESS.md: toggle kantong lumpur mengubah
    // bobot 18 node, termasuk "Fasilitas penguras berfungsi" yang berbobot 0
    // justru saat kantong lumpur ADA. Gampang terlewat karena letaknya jauh
    // dari sub-pohon kantong lumpur.
    const penguras = "I.3.3-3.a.a-1.ii";
    for (const j of ["talang", "gorong_gorong"] as const) {
      expect(indikatorUntukAset(j, "ada"), j).not.toContain(penguras);
      expect(indikatorUntukAset(j, "tidak"), j).toContain(penguras);
    }
  });

  it("tidak mengubah jenis yang memang tidak tersentuh kantong lumpur", () => {
    for (const j of JENIS_PER_UNIT) {
      if (j === "bendung" || j === "talang" || j === "gorong_gorong") continue;
      expect(indikatorUntukAset(j, "ada"), j).toEqual(indikatorUntukAset(j, "tidak"));
    }
  });
});

describe("rata-rata per indikator", () => {
  it("merata-ratakan nilai lintas bangunan", () => {
    const baris: BarisNilaiAset[] = [
      { asetId: 1, indikatorKode: "I.3.3-1.a.i", nilai: 60 },
      { asetId: 2, indikatorKode: "I.3.3-1.a.i", nilai: 80 },
      { asetId: 3, indikatorKode: "I.3.3-1.a.i", nilai: 100 },
    ];
    expect(rataRataPerIndikator(baris)["I.3.3-1.a.i"]).toBeCloseTo(80, 10);
  });

  it("melewati bangunan yang belum dinilai, bukan menganggapnya nol", () => {
    const baris: BarisNilaiAset[] = [
      { asetId: 1, indikatorKode: "I.3.3-1.a.i", nilai: 80 },
      { asetId: 2, indikatorKode: "I.3.3-1.a.i", nilai: null },
      { asetId: 3, indikatorKode: "I.3.3-1.a.i", nilai: 100 },
    ];
    // Bila yang kosong dianggap 0, hasilnya 60.
    expect(rataRataPerIndikator(baris)["I.3.3-1.a.i"]).toBeCloseTo(90, 10);
  });

  it("tidak memunculkan indikator yang tidak punya satu pun nilai", () => {
    const hasil = rataRataPerIndikator([
      { asetId: 1, indikatorKode: "I.3.3-1.a.i", nilai: null },
    ]);
    expect("I.3.3-1.a.i" in hasil).toBe(false);
  });

  it("membuat hitungSkor memperlakukan indikator tanpa nilai sebagai belum dinilai", () => {
    const hasil = hitungSkor(rataRataPerIndikator([]), "ada");
    expect(hasil.nilai.get("I.3.3-1.a")).toBeNull();
    expect(hasil.terisi).toBe(0);
  });
});

/**
 * Inti dari seluruh rancangan ini.
 *
 * Blangko menghitung nilai tiap bangunan lebih dulu, baru merata-ratakannya.
 * Sistem merata-ratakan tiap indikator lebih dulu, baru mengalikan bobot.
 * Kedua urutan itu wajib menghasilkan angka yang sama persis, karena kalau
 * tidak, seluruh alasan untuk tidak menyentuh mesin skoring runtuh.
 */
describe("kesetaraan dengan cara blangko", () => {
  /**
   * Nilai satu bangunan menurut cara blangko.
   *
   * Memakai mesin skoring itu sendiri, bukan rumus tiruan: kelompok seperti
   * I.1.1-1 bertingkat dua (sum_children di atas weighted_children), jadi
   * penjumlahan datar akan salah dan diam-diam meloloskan test.
   */
  function nilaiSatuBangunan(
    kelompok: string,
    nilai: Record<string, number>,
    kl: KantongLumpur,
  ): number {
    return hitungSkor(nilai, kl).nilai.get(kelompok)!;
  }

  const kasus: [JenisAset, string][] = [
    ["sadap", "I.3.3-1.a"],
    ["saluran", "I.2.2-1"],
    ["talang", "I.3.3-3.a.a-1"],
    ["terjunan", "I.3.3-3.a.a-3"],
  ];

  for (const [jenis, kelompok] of kasus) {
    it(`sama persis untuk ${jenis} pada ${kelompok}`, () => {
      const rng = acak(20260915);
      const kl: KantongLumpur = "ada";
      const daun = kelompokUntukAset(jenis, kl)
        .find((k) => k.kode === kelompok)!
        .daun.map((d) => d.kode);

      for (const jumlahBangunan of [1, 2, 7, 41, 68]) {
        const baris: BarisNilaiAset[] = [];
        const perBangunan: number[] = [];

        for (let j = 0; j < jumlahBangunan; j++) {
          const nilai: Record<string, number> = {};
          for (const k of daun) {
            nilai[k] = Math.round(rng() * 100);
            baris.push({ asetId: j, indikatorKode: k, nilai: nilai[k] });
          }
          perBangunan.push(nilaiSatuBangunan(kelompok, nilai, kl));
        }

        // Cara blangko: rata-rata dari nilai tiap bangunan.
        const caraBlangko =
          perBangunan.reduce((a, b) => a + b, 0) / perBangunan.length;

        // Cara sistem: rata-rata tiap indikator, lalu lewat mesin skoring.
        const caraSistem = hitungSkor(rataRataPerIndikator(baris), kl).nilai.get(
          kelompok,
        )!;

        expect(Math.abs(caraSistem - caraBlangko), `${jumlahBangunan} bangunan`).toBeLessThan(
          EPS,
        );
      }
    });
  }

  it("sama persis untuk bendung lintas seluruh kelompoknya sekaligus", () => {
    const rng = acak(7);
    for (const kl of ["ada", "tidak"] as const) {
      for (const kelompok of kelompokUntukAset("bendung", kl)) {
        const daun = kelompok.daun.map((d) => d.kode);
        const baris: BarisNilaiAset[] = [];
        const perBangunan: number[] = [];

        for (let j = 0; j < 6; j++) {
          const nilai: Record<string, number> = {};
          for (const k of daun) {
            nilai[k] = Math.round(rng() * 100);
            baris.push({ asetId: j, indikatorKode: k, nilai: nilai[k] });
          }
          perBangunan.push(nilaiSatuBangunan(kelompok.kode, nilai, kl));
        }

        const caraBlangko = perBangunan.reduce((a, b) => a + b, 0) / perBangunan.length;
        const caraSistem = hitungSkor(rataRataPerIndikator(baris), kl).nilai.get(
          kelompok.kode,
        )!;
        expect(Math.abs(caraSistem - caraBlangko), `${kl} ${kelompok.kode}`).toBeLessThan(
          EPS,
        );
      }
    }
  });
});

describe("penggabungan dengan nilai agregat", () => {
  it("mempertahankan nilai agregat dan memakai rata-rata untuk indikator per unit", () => {
    const agregat = {
      "I.2.2-3.i": 75, // agregat, harus lolos apa adanya
      "I.3.3-1.a.i": 10, // per unit, harus dikalahkan rata-rata
    };
    const baris: BarisNilaiAset[] = [
      { asetId: 1, indikatorKode: "I.3.3-1.a.i", nilai: 90 },
      { asetId: 2, indikatorKode: "I.3.3-1.a.i", nilai: 70 },
    ];

    const gabungan = gabungNilai(agregat, baris);
    expect(gabungan["I.2.2-3.i"]).toBe(75);
    expect(gabungan["I.3.3-1.a.i"]).toBeCloseTo(80, 10);
  });

  it("membuang nilai manual basi pada indikator per unit yang belum punya baris", () => {
    // Nilai peninggalan sebelum modul ini ada tidak boleh diam-diam terhitung.
    const gabungan = gabungNilai({ "I.3.3-1.a.i": 100 }, []);
    expect("I.3.3-1.a.i" in gabungan).toBe(false);
  });

  it("menghasilkan total 100 saat seluruh indikator bernilai 100, lewat jalur campuran", () => {
    for (const kl of ["ada", "tidak"] as const) {
      const agregat: Record<string, number> = {};
      for (const n of INDIKATOR_INPUT) {
        if (!INDIKATOR_PER_UNIT.has(n.kode)) agregat[n.kode] = 100;
      }
      const baris: BarisNilaiAset[] = [...INDIKATOR_PER_UNIT].flatMap((k) =>
        [1, 2, 3].map((asetId) => ({ asetId, indikatorKode: k, nilai: 100 })),
      );

      const hasil = hitungSkor(gabungNilai(agregat, baris), kl);
      expect(hasil.total, kl).toBeCloseTo(100, 6);
    }
  });
});

describe("statistik pengisian", () => {
  const aset = [
    { id: 1, jenis: "sadap" as const },
    { id: 2, jenis: "sadap" as const },
    { id: 3, jenis: "sadap" as const },
    { id: 9, jenis: "tanah_rumah" as const },
  ];
  const daunSadap = indikatorUntukAset("sadap", "ada");

  it("memisahkan bangunan lengkap, sebagian, dan belum tersentuh", () => {
    const baris = [
      ...daunSadap.map((k) => ({ asetId: 1, indikatorKode: k, nilai: 80 })),
      { asetId: 2, indikatorKode: daunSadap[0], nilai: 70 },
    ];
    const [s] = statistikPengisian(aset, baris, "ada");
    expect(s.jenis).toBe("sadap");
    expect(s.bangunan).toBe(3);
    expect(s.lengkap).toBe(1);
    expect(s.sebagian).toBe(1);
  });

  it("mengabaikan aset yang tidak dinilai per unit", () => {
    const hasil = statistikPengisian(aset, [], "ada");
    expect(hasil).toHaveLength(1);
    expect(hasil[0].jenis).toBe("sadap");
  });

  it("menandai bangunan yang nilainya seluruhnya dari pengisian massal", () => {
    const baris = [
      ...daunSadap.map((k) => ({ asetId: 1, indikatorKode: k, nilai: 80, massal: true })),
      ...daunSadap.map((k) => ({ asetId: 2, indikatorKode: k, nilai: 80, massal: true })),
      // Bangunan 3 diperiksa sungguhan.
      ...daunSadap.map((k) => ({ asetId: 3, indikatorKode: k, nilai: 65, massal: false })),
    ];
    const [s] = statistikPengisian(aset, baris, "ada");
    expect(s.lengkap).toBe(3);
    expect(s.massal).toBe(2);
  });
});
