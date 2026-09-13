import ExcelJS from "exceljs";

import type { RekapPeriode } from "@/lib/data/rekap";

/**
 * Membangun berkas Excel rekapitulasi yang mereplikasi template
 * "9 - Areal Terdampak dan IKSI" dari IKSI 2026 FINAL.xlsx.
 *
 * Tata letak disusun ulang (bukan menimpa berkas template) supaya jumlah baris
 * bisa mengikuti hasil penyaringan UPT tanpa merusak merge di bawah tabel.
 * Lebar kolom, format angka, merge, dan teks catatan diambil persis dari sumber.
 */

const NAMA_SHEET = "9 - Areal Terdampak dan IKSI";

/**
 * Format akuntansi kolom areal & skor, disalin dari template.
 *
 * Tanpa escape `\-` pada bagian negatif: Excel menyimpannya dengan escape,
 * tetapi ExcelJS menormalkan ke bentuk ini baik saat membaca maupun menulis.
 * Memakai bentuk ternormalisasi membuat keluaran identik dengan template
 * (diverifikasi di rekap-excel.test.ts).
 */
const FMT_AKUNTANSI = '_-* #,##0.00_-;-* #,##0.00_-;_-* "-"_-;_-@_-';
const FMT_LUAS = "0.00";
const FMT_NO = "0";

const LEBAR: Record<string, number> = {
  A: 2.89, B: 4.55, C: 4.44, D: 25.11, E: 14.66, F: 17, G: 13.33,
  H: 11.89, I: 12.33, J: 12.33, K: 12.33, L: 12.33, M: 18.44,
  N: 14.89, O: 12.33, P: 13, Q: 14.89, R: 17.66, S: 12.55, T: 4.33,
};

const GARIS_TIPIS: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const GARIS_DATA: Partial<ExcelJS.Borders> = {
  left: { style: "thin" },
  right: { style: "thin" },
  bottom: { style: "hair" },
};

export interface OpsiEkspor {
  /** Judul wilayah, mis. "TEMANGGUNG". */
  kabupaten?: string;
  provinsi?: string;
  /** Blok tanda tangan. */
  tandaTangan?: {
    tempatTanggal: string;
    jabatan: string[];
    nama: string;
    nip: string;
  };
  /** Label UPT bila ekspor disaring per UPT. */
  labelUpt?: string | null;
}

const TTD_BAWAAN: NonNullable<OpsiEkspor["tandaTangan"]> = {
  tempatTanggal: "Temanggung,",
  jabatan: ["KEPALA DINAS PEKERJAAN UMUM", "DAN PENATAAN RUANG", "KABUPATEN TEMANGGUNG"],
  nama: "",
  nip: "NIP.",
};

export async function bangunRekapExcel(
  rekap: RekapPeriode,
  opsi: OpsiEkspor = {},
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIKSI — Dinas PUPR Kabupaten Temanggung";
  wb.created = new Date();

  const ws = wb.addWorksheet(NAMA_SHEET, {
    views: [{ state: "frozen", xSplit: 5, ySplit: 9 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  for (const [kolom, lebar] of Object.entries(LEBAR)) {
    ws.getColumn(kolom).width = lebar;
  }

  /* ------------------------------------------------------------ judul */

  ws.getCell("B2").value = "INDEKS KINERJA SISTEM IRIGASI";
  ws.getCell("B2").font = { bold: true, size: 14 };
  ws.getRow(2).height = 24.6;

  ws.getCell("B3").value = `KAB./KOTA  : ${opsi.kabupaten ?? "TEMANGGUNG"}`;
  ws.getCell("B4").value = `PROVINSI    : ${opsi.provinsi ?? "JAWA TENGAH"}`;
  for (const c of ["B3", "B4"]) ws.getCell(c).font = { bold: true, size: 11 };

  ws.getCell("B5").value = opsi.labelUpt
    ? `UPT             : ${opsi.labelUpt}`
    : null;
  ws.getCell("B5").font = { bold: true, size: 11 };

  /* ----------------------------------------------------------- header */

  ws.mergeCells("B6:B8");
  ws.mergeCells("C6:D8");
  ws.mergeCells("F6:F8");
  ws.mergeCells("G6:M6");
  ws.mergeCells("N6:S6");
  for (const k of ["G", "H", "I", "J", "K", "L"]) ws.mergeCells(`${k}7:${k}8`);

  ws.getCell("B6").value = "No.";
  ws.getCell("C6").value = "Nomeklatur/\nNama Daerah Irigasi";
  ws.getCell("E7").value = "Tahun";
  ws.getCell("F6").value = "Luas Daerah Irigasi Sesuai Permen 14/2015 (Ha)";
  ws.getCell("G6").value = "Prasarana Fisik";
  ws.getCell("N6").value = "Indeks Kondisi Sistem Irigasi (%)";

  const SUB: [string, string][] = [
    ["G7", "Bangunan Utama"],
    ["H7", "Saluran Pembawa"],
    ["I7", "Bangunan pada Saluran Pembawa"],
    ["J7", "Saluran Pembuang dan Bangunannya"],
    ["K7", "Jalan Masuk/Inspeksi"],
    ["L7", "Kantor Perumahan dan Gudang"],
    ["M7", "Total Prasarana Fisik"],
    ["N7", "Produktivitas"],
    ["O7", "Sarana Penujang"],
    ["P7", "Organisasi Personalia"],
    ["Q7", "Dokumentasi"],
    ["R7", "P3A/GP3A/IP3A"],
    ["S7", "Jumlah"],
  ];
  for (const [sel, teks] of SUB) ws.getCell(sel).value = teks;

  const MAKS: [string, string][] = [
    ["M8", "Nilai Maks 45%"],
    ["N8", "Nilai Maks 15%"],
    ["O8", "Nilai Maks 10%"],
    ["P8", "Nilai Maks 15%"],
    ["Q8", "Nilai Maks 5%"],
    ["R8", "Nilai Maks 10%"],
    ["S8", "Nilai Maks 100%"],
  ];
  for (const [sel, teks] of MAKS) ws.getCell(sel).value = teks;

  ws.getRow(6).height = 20.25;
  ws.getRow(7).height = 33;
  ws.getRow(8).height = 33.6;

  for (const baris of [6, 7, 8]) {
    for (let c = 2; c <= 19; c++) {
      const sel = ws.getRow(baris).getCell(c);
      sel.font = { bold: true, size: 11 };
      sel.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      sel.border = GARIS_TIPIS;
    }
  }

  /* ------------------------------------------- baris 9: nomor kolom */

  // Penomoran mengikuti template apa adanya — kolom 10 memang dilewati di sumber.
  const NOMOR: [number, number][] = [
    [2, 1], [3, 2], [6, 3], [7, 4], [8, 5], [9, 6], [10, 7], [11, 8],
    [12, 9], [13, 11], [14, 12], [15, 13], [16, 14], [17, 15], [18, 16], [19, 17],
  ];
  ws.mergeCells("C9:D9");
  for (const [kol, nomor] of NOMOR) {
    const sel = ws.getRow(9).getCell(kol);
    sel.value = nomor;
    sel.font = { bold: true, size: 11 };
    sel.alignment = { horizontal: "center", vertical: "middle" };
    sel.numFmt = FMT_NO;
    sel.border = GARIS_TIPIS;
  }
  for (const kol of [4, 5]) {
    ws.getRow(9).getCell(kol).border = GARIS_TIPIS;
  }
  ws.getRow(9).height = 15;

  /* ------------------------------------------------------------ data */

  const BARIS_AWAL = 10;

  rekap.baris.forEach((b, i) => {
    const r = ws.getRow(BARIS_AWAL + i);
    r.height = 18.75;

    r.getCell(2).value = b.no;
    r.getCell(3).value = "D.I.";
    // Template memisahkan awalan "D.I." (kolom C) dari nama (kolom D).
    r.getCell(4).value = b.nama.replace(/^D\.I\.\s*/i, "");
    r.getCell(6).value = b.luasBaku;

    r.getCell(7).value = b.areal.bangunanUtama;
    r.getCell(8).value = b.areal.saluranPembawa;
    r.getCell(9).value = b.areal.bangunanSaluranPembawa;
    r.getCell(10).value = b.areal.saluranPembuang;
    r.getCell(11).value = b.areal.jalanInspeksi;
    r.getCell(12).value = b.areal.kantorPerumahanGudang;

    r.getCell(13).value = b.skor.prasaranaFisik;
    r.getCell(14).value = b.skor.produktivitas;
    r.getCell(15).value = b.skor.saranaPenunjang;
    r.getCell(16).value = b.skor.organisasi;
    r.getCell(17).value = b.skor.dokumentasi;
    r.getCell(18).value = b.skor.p3a;

    // Jumlah ditulis sebagai formula agar berkas tetap "hidup" saat diedit.
    const nomorBaris = BARIS_AWAL + i;
    r.getCell(19).value = { formula: `SUM(M${nomorBaris}:R${nomorBaris})` };

    for (let c = 2; c <= 19; c++) {
      const sel = r.getCell(c);
      sel.border = GARIS_DATA;
      sel.font = { size: 11 };
      sel.alignment =
        c === 3 || c === 4
          ? { horizontal: "left", vertical: "middle" }
          : { horizontal: "center", vertical: "middle" };
      if (c === 2) sel.numFmt = FMT_NO;
      else if (c === 6) sel.numFmt = FMT_LUAS;
      else if (c >= 7) sel.numFmt = FMT_AKUNTANSI;
    }
  });

  /* ------------------------------------------------------ baris total */

  const barisTotal = BARIS_AWAL + rekap.baris.length;
  const akhirData = barisTotal - 1;
  const rT = ws.getRow(barisTotal);

  ws.mergeCells(`B${barisTotal}:D${barisTotal}`);
  rT.getCell(2).value = "Total";

  if (rekap.baris.length > 0) {
    // Luas & areal dijumlahkan; skor komponen dirata-ratakan — sesuai template.
    for (const kol of ["F", "G", "H", "I", "J", "K", "L"]) {
      ws.getCell(`${kol}${barisTotal}`).value = {
        formula: `SUM(${kol}${BARIS_AWAL}:${kol}${akhirData})`,
      };
    }
    for (const kol of ["M", "N", "O", "P", "Q", "R"]) {
      ws.getCell(`${kol}${barisTotal}`).value = {
        formula: `IF(COUNT(${kol}${BARIS_AWAL}:${kol}${akhirData})=0,0,AVERAGE(${kol}${BARIS_AWAL}:${kol}${akhirData}))`,
      };
    }
    ws.getCell(`S${barisTotal}`).value = {
      formula: `SUM(M${barisTotal}:R${barisTotal})`,
    };
  }

  for (let c = 2; c <= 19; c++) {
    const sel = rT.getCell(c);
    sel.font = { bold: true, size: 11 };
    sel.alignment = { horizontal: "center", vertical: "middle" };
    sel.border = GARIS_TIPIS;
    if (c === 6) sel.numFmt = FMT_LUAS;
    else if (c >= 7) sel.numFmt = FMT_AKUNTANSI;
  }

  /* ---------------------------------------------------------- catatan */

  const CATATAN: [string | null, string][] = [
    [null, "CATATAN :"],
    [
      "1",
      "Kolom 2-3:  Semua daerah irigasi kewenangan berdasarkan Permen PUPR No. 14/PRT/M/2015. Apabila ada daerah irigasi baru di luar Permen PUPR No. 14/PRT/M/2015 agar ditambahkan di baris yang paling bawah.",
    ],
    ["2", "Kolom 4-8 : Diisi areal terdampak dari kondisi jaringan irigasi yang ada. "],
    [
      "",
      "Total luas areal terdampak (Kolom 4+5+6+7) tidak boleh melebihi luas daerah irigasi berdasarkan Permen PUPR No. 14/PRT/M/2015 (Kolom 3).",
    ],
    [
      "3",
      "Penilaian indeks kinerja sistem irigasi(Kolom 9-15) mengacu pada Permen PUPR No. 12/PRT/M/2015 dengan kriteria sebagai berikut:",
    ],
    ["", "a. Nilai IKSI 80%-100%: Kinerja Sangat Baik (SB)."],
    ["", "b. Nilai IKSI 70%-79%: Baik (B)."],
    ["", "c. Nilai IKSI 55%-69%: Kinerja Kurang (K) dan perlu perhatian."],
    ["", "d. Nilai IKSI <55%: Kinerja Jelek (J) dan perlu segera penanganan."],
    [
      "",
      "Nilai maksimum Kolom 9: 45%, Kolom 10: 15%, Kolom 11: 10%, Kolom 12: 15%, Kolom 13: 5%, Kolom 14: 10% dan Kolom 15: 100%.",
    ],
    [
      "4",
      "*Dapat dihapus bila memang berdasarkan Permen PUPR No. 14/PRT/M/2015 tidak memiliki kewenangan jenis daerah irigasi tersebut.",
    ],
  ];

  const awalCatatan = barisTotal + 2;
  CATATAN.forEach(([nomor, teks], i) => {
    const r = ws.getRow(awalCatatan + i);
    if (nomor) r.getCell(2).value = Number.isNaN(Number(nomor)) ? nomor : Number(nomor);
    r.getCell(3).value = teks;
    r.getCell(2).font = { size: 11 };
    r.getCell(3).font = { size: 11, bold: i === 0 };
    r.getCell(3).alignment = { vertical: "top" };
  });

  /* ---------------------------------------------------- tanda tangan */

  const ttd = { ...TTD_BAWAAN, ...(opsi.tandaTangan ?? {}) };
  const awalTtd = awalCatatan + CATATAN.length + 2;

  const barisTtd: (string | null)[] = [
    ttd.tempatTanggal,
    ...ttd.jabatan,
    null,
    null,
    null,
    null,
    ttd.nama,
    ttd.nip,
  ];

  barisTtd.forEach((teks, i) => {
    const nomorBaris = awalTtd + i;
    ws.mergeCells(`Q${nomorBaris}:S${nomorBaris}`);
    if (teks === null) return;
    const sel = ws.getCell(`Q${nomorBaris}`);
    sel.value = teks;
    sel.alignment = { horizontal: "center", vertical: "middle" };
    // Nama penanda tangan digarisbawahi seperti pada template.
    sel.font = { size: 11, bold: teks === ttd.nama && teks !== "", underline: teks === ttd.nama && teks !== "" };
  });

  return wb.xlsx.writeBuffer();
}

/** Nama berkas unduhan. */
export function namaBerkasRekap(
  tahun: number,
  triwulan: string,
  labelUpt?: string | null,
): string {
  const periode = triwulan.trim().replace(/\s+/g, "-");
  const upt = labelUpt ? `_${labelUpt.replace(/[^\w]+/g, "-")}` : "";
  return `IKSI_${tahun}_${periode}${upt}.xlsx`;
}
