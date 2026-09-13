import { existsSync } from "node:fs";
import { resolve } from "node:path";

import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";

import type { BarisRekap, RekapPeriode } from "@/lib/data/rekap";

import { bangunRekapExcel, namaBerkasRekap } from "./rekap-excel";

/** Template sumber, dipakai sebagai acuan kebenaran tata letak. */
const TEMPLATE = resolve(import.meta.dirname, "../../../../IKSI 2026 FINAL.xlsx");
const NAMA_SHEET = "9 - Areal Terdampak dan IKSI";

function barisContoh(no: number, nama: string, dinilai: boolean): BarisRekap {
  return {
    no,
    diId: no,
    kode: `3323${String(no).padStart(4, "0")}`,
    nama,
    kecamatan: "Wonoboyo",
    uptNama: "Regional III - Ngadirejo",
    luasBaku: 65,
    areal: dinilai
      ? {
          bangunanUtama: 39.65,
          saluranPembawa: 4.55,
          bangunanSaluranPembawa: 7.8,
          saluranPembuang: 0,
          jalanInspeksi: 0,
          kantorPerumahanGudang: 13,
        }
      : {
          bangunanUtama: null,
          saluranPembawa: null,
          bangunanSaluranPembawa: null,
          saluranPembuang: null,
          jalanInspeksi: null,
          kantorPerumahanGudang: null,
        },
    skor: dinilai
      ? {
          prasaranaFisik: 18.55,
          produktivitas: 10.24,
          saranaPenunjang: 7.32,
          organisasi: 11.2,
          dokumentasi: 4.25,
          p3a: 8.5,
        }
      : {
          prasaranaFisik: null,
          produktivitas: null,
          saranaPenunjang: null,
          organisasi: null,
          dokumentasi: null,
          p3a: null,
        },
    total: dinilai ? 60.06 : null,
    kategori: dinilai ? "KURANG" : null,
    status: dinilai ? "disetujui" : null,
    penilaianId: dinilai ? `id-${no}` : null,
  };
}

const REKAP: RekapPeriode = {
  tahun: 2026,
  triwulan: "Triwulan III",
  baris: [
    barisContoh(1, "D.I. Aji Bangkong", true),
    barisContoh(2, "D.I. Aji Barang", true),
    barisContoh(3, "D.I. Aji Bulu", false),
  ],
  total: {
    luasBaku: 195,
    areal: {
      bangunanUtama: 79.3,
      saluranPembawa: 9.1,
      bangunanSaluranPembawa: 15.6,
      saluranPembuang: 0,
      jalanInspeksi: 0,
      kantorPerumahanGudang: 26,
    },
    skor: {
      prasaranaFisik: 18.55,
      produktivitas: 10.24,
      saranaPenunjang: 7.32,
      organisasi: 11.2,
      dokumentasi: 4.25,
      p3a: 8.5,
    },
    total: 60.06,
  },
  jumlahDinilai: 2,
  distribusi: { SANGAT_BAIK: 0, BAIK: 0, KURANG: 2, JELEK: 0 },
};

let ws: ExcelJS.Worksheet;

beforeAll(async () => {
  const buffer = await bangunRekapExcel(REKAP);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  ws = wb.getWorksheet(NAMA_SHEET)!;
});

describe("struktur berkas", () => {
  it("memakai nama sheet yang sama dengan template", () => {
    expect(ws).toBeDefined();
  });

  it("membekukan panel di F10 seperti template", () => {
    const view = ws.views?.[0] as ExcelJS.WorksheetViewFrozen;
    expect(view.state).toBe("frozen");
    expect(view.xSplit).toBe(5);
    expect(view.ySplit).toBe(9);
  });

  it("menulis judul dan identitas wilayah", () => {
    expect(ws.getCell("B2").value).toBe("INDEKS KINERJA SISTEM IRIGASI");
    expect(ws.getCell("B3").value).toBe("KAB./KOTA  : TEMANGGUNG");
    expect(ws.getCell("B4").value).toBe("PROVINSI    : JAWA TENGAH");
  });
});

describe("header tabel", () => {
  it("menulis seluruh judul kolom komponen", () => {
    expect(ws.getCell("B6").value).toBe("No.");
    expect(ws.getCell("F6").value).toBe("Luas Daerah Irigasi Sesuai Permen 14/2015 (Ha)");
    expect(ws.getCell("G6").value).toBe("Prasarana Fisik");
    expect(ws.getCell("N6").value).toBe("Indeks Kondisi Sistem Irigasi (%)");
    expect(ws.getCell("M7").value).toBe("Total Prasarana Fisik");
    expect(ws.getCell("S7").value).toBe("Jumlah");
  });

  it("menulis nilai maksimum tiap komponen sesuai Permen", () => {
    expect(ws.getCell("M8").value).toBe("Nilai Maks 45%");
    expect(ws.getCell("N8").value).toBe("Nilai Maks 15%");
    expect(ws.getCell("O8").value).toBe("Nilai Maks 10%");
    expect(ws.getCell("P8").value).toBe("Nilai Maks 15%");
    expect(ws.getCell("Q8").value).toBe("Nilai Maks 5%");
    expect(ws.getCell("R8").value).toBe("Nilai Maks 10%");
    expect(ws.getCell("S8").value).toBe("Nilai Maks 100%");
  });

  it("mempertahankan penomoran kolom template (kolom 10 memang dilewati)", () => {
    expect(ws.getCell("B9").value).toBe(1);
    expect(ws.getCell("F9").value).toBe(3);
    expect(ws.getCell("L9").value).toBe(9);
    expect(ws.getCell("M9").value).toBe(11);
    expect(ws.getCell("S9").value).toBe(17);
  });
});

describe("baris data", () => {
  it("memisahkan awalan D.I. dari nama, seperti template", () => {
    expect(ws.getCell("C10").value).toBe("D.I.");
    expect(ws.getCell("D10").value).toBe("Aji Bangkong");
    expect(ws.getCell("D12").value).toBe("Aji Bulu");
  });

  it("menulis areal terdampak dan skor komponen pada kolom yang benar", () => {
    expect(ws.getCell("F10").value).toBe(65);
    expect(ws.getCell("G10").value).toBe(39.65);
    expect(ws.getCell("L10").value).toBe(13);
    expect(ws.getCell("M10").value).toBe(18.55);
    expect(ws.getCell("R10").value).toBe(8.5);
  });

  it("menulis Jumlah sebagai formula, bukan angka mati", () => {
    expect(ws.getCell("S10").value).toMatchObject({ formula: "SUM(M10:R10)" });
    expect(ws.getCell("S11").value).toMatchObject({ formula: "SUM(M11:R11)" });
  });

  it("membiarkan sel kosong untuk D.I. yang belum dinilai", () => {
    expect(ws.getCell("M12").value).toBeNull();
    expect(ws.getCell("G12").value).toBeNull();
  });

  it("memakai format akuntansi pada kolom areal & skor", () => {
    expect(ws.getCell("G10").numFmt).toBe('_-* #,##0.00_-;-* #,##0.00_-;_-* "-"_-;_-@_-');
    expect(ws.getCell("F10").numFmt).toBe("0.00");
  });
});

describe("baris total", () => {
  const BARIS = 13; // 10 + 3 baris data

  it("menjumlahkan luas dan areal", () => {
    expect(ws.getCell(`F${BARIS}`).value).toMatchObject({ formula: "SUM(F10:F12)" });
    expect(ws.getCell(`G${BARIS}`).value).toMatchObject({ formula: "SUM(G10:G12)" });
  });

  it("MERATA-RATAKAN skor komponen, bukan menjumlahkan", () => {
    // Ini pembeda penting dari kolom luas — template memakai AVERAGE di M..R.
    expect(ws.getCell(`M${BARIS}`).value).toMatchObject({
      formula: "IF(COUNT(M10:M12)=0,0,AVERAGE(M10:M12))",
    });
    expect(ws.getCell(`R${BARIS}`).value).toMatchObject({
      formula: "IF(COUNT(R10:R12)=0,0,AVERAGE(R10:R12))",
    });
  });

  it("menjumlahkan rata-rata komponen untuk kolom Jumlah", () => {
    expect(ws.getCell(`S${BARIS}`).value).toMatchObject({
      formula: `SUM(M${BARIS}:R${BARIS})`,
    });
  });

  it("diberi label Total", () => {
    expect(ws.getCell(`B${BARIS}`).value).toBe("Total");
  });
});

describe("catatan kaki", () => {
  it("memuat keempat kriteria kategori IKSI Permen 12/2015", () => {
    const teks: string[] = [];
    ws.eachRow((row) => {
      const v = row.getCell(3).value;
      if (typeof v === "string") teks.push(v);
    });
    const gabung = teks.join("\n");
    expect(gabung).toContain("a. Nilai IKSI 80%-100%: Kinerja Sangat Baik (SB).");
    expect(gabung).toContain("b. Nilai IKSI 70%-79%: Baik (B).");
    expect(gabung).toContain("c. Nilai IKSI 55%-69%: Kinerja Kurang (K) dan perlu perhatian.");
    expect(gabung).toContain("d. Nilai IKSI <55%: Kinerja Jelek (J) dan perlu segera penanganan.");
    expect(gabung).toContain("Nilai maksimum Kolom 9: 45%");
  });
});

describe("nama berkas", () => {
  it("menyusun nama yang aman untuk sistem berkas", () => {
    expect(namaBerkasRekap(2026, "Triwulan III")).toBe("IKSI_2026_Triwulan-III.xlsx");
    expect(namaBerkasRekap(2026, "Triwulan I", "Regional III - Ngadirejo")).toBe(
      "IKSI_2026_Triwulan-I_Regional-III-Ngadirejo.xlsx",
    );
  });
});

/* ------------------------------------------------------------------ */
/* Paritas dengan template sumber                                      */
/* ------------------------------------------------------------------ */

describe.runIf(existsSync(TEMPLATE))("paritas dengan IKSI 2026 FINAL.xlsx", () => {
  let asli: ExcelJS.Worksheet;

  beforeAll(async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    asli = wb.getWorksheet(NAMA_SHEET)!;
  });

  it("judul kolom identik dengan template", () => {
    const sel = [
      "B6", "F6", "G6", "N6",
      "G7", "H7", "I7", "J7", "K7", "L7", "M7", "N7", "O7", "P7", "Q7", "R7", "S7",
      "M8", "N8", "O8", "P8", "Q8", "R8", "S8",
    ];
    for (const s of sel) {
      expect(String(ws.getCell(s).value ?? "").trim(), s).toBe(
        String(asli.getCell(s).value ?? "").trim(),
      );
    }
  });

  it("penomoran kolom baris 9 identik dengan template", () => {
    for (const s of ["B9", "F9", "G9", "H9", "I9", "J9", "K9", "L9", "M9", "N9", "O9", "P9", "Q9", "R9", "S9"]) {
      expect(ws.getCell(s).value, s).toBe(asli.getCell(s).value);
    }
  });

  it("format angka identik dengan template", () => {
    for (const s of ["B10", "F10", "G10", "M10", "S10"]) {
      expect(ws.getCell(s).numFmt, s).toBe(asli.getCell(s).numFmt);
    }
  });

  it("lebar kolom mengikuti template", () => {
    for (const k of ["B", "C", "D", "E", "F", "G", "H", "I", "M", "N", "O", "P", "Q", "R", "S"]) {
      const kita = ws.getColumn(k).width ?? 0;
      const sumber = asli.getColumn(k).width ?? 0;
      expect(Math.abs(kita - sumber), `kolom ${k}`).toBeLessThan(0.1);
    }
  });
});
