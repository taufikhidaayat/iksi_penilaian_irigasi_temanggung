import { describe, expect, it } from "vitest";

import { formatAngkaPotong, formatPanjang } from "@/lib/utils";

describe("formatAngkaPotong", () => {
  it("memotong pecahan, tidak membulatkan", () => {
    // Contoh yang diminta Dinas: 48,987652 harus tampil 48,98, bukan 48,99.
    expect(formatAngkaPotong(48.987652)).toBe("48,98");
    expect(formatAngkaPotong(62.6261711408)).toBe("62,62");
    expect(formatAngkaPotong(103.460190395)).toBe("103,46");
  });

  it("tidak membulatkan ke atas walau angka berikutnya 9", () => {
    expect(formatAngkaPotong(1.999)).toBe("1,99");
    expect(formatAngkaPotong(0.999)).toBe("0,99");
  });

  it("memakai pemisah ribuan gaya Indonesia", () => {
    expect(formatAngkaPotong(2346.4357939)).toBe("2.346,43");
    expect(formatAngkaPotong(1803.75177596)).toBe("1.803,75");
  });

  it("melengkapi angka nol di belakang koma", () => {
    expect(formatAngkaPotong(5)).toBe("5,00");
    expect(formatAngkaPotong(5.5)).toBe("5,50");
    expect(formatAngkaPotong(5.07)).toBe("5,07");
  });

  it("menangani nol dan nilai kosong", () => {
    expect(formatAngkaPotong(0)).toBe("0,00");
    expect(formatAngkaPotong(null)).toBe("–");
    expect(formatAngkaPotong(undefined)).toBe("–");
    expect(formatAngkaPotong(Number.NaN)).toBe("–");
  });

  it("memotong ke arah nol untuk nilai negatif", () => {
    expect(formatAngkaPotong(-1.999)).toBe("-1,99");
  });

  it("menghormati jumlah desimal yang diminta", () => {
    expect(formatAngkaPotong(48.987652, 0)).toBe("48");
    expect(formatAngkaPotong(48.987652, 1)).toBe("48,9");
    expect(formatAngkaPotong(48.987652, 4)).toBe("48,9876");
  });
});

describe("formatPanjang", () => {
  it("menambahkan satuan meter", () => {
    expect(formatPanjang(408.753658239)).toBe("408,75 m");
    expect(formatPanjang(0)).toBe("0,00 m");
  });

  it("membedakan belum terdata dari nol", () => {
    // 43 saluran tercatat panjang 0 di berkas GIS; itu keterangan yang berbeda
    // artinya dari "belum terdata", jadi keduanya tidak boleh tampil sama.
    expect(formatPanjang(null)).toBe("–");
    expect(formatPanjang(0)).not.toBe(formatPanjang(null));
  });
});
