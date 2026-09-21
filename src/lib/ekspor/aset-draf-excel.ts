import ExcelJS from "exceljs";

import type { AsetDraf, AsetDrafBerkas } from "@/lib/supabase/types";

/**
 * Membangun ulang berkas draf satu jenis aset.
 *
 * Susunan kolom, nama kolom, dan nama sheet diambil dari
 * `aset_draf_berkas`, jadi hasilnya sejajar dengan berkas draf aslinya.
 * Yang berbeda hanya nomor aset: kolom kode sudah memakai kodefikasi
 * golongan + UPT (lihat migrasi 0010), sama dengan menu Aset Irigasi.
 *
 * Header dibekukan dan diberi filter, dua hal yang tidak ada di berkas asli
 * tetapi tidak mengubah isi datanya. Tabel 4.669 baris dengan 29 kolom praktis
 * tidak bisa dibaca tanpa keduanya.
 */
export async function bangunDrafExcel(
  berkas: AsetDrafBerkas,
  baris: AsetDraf[],
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIKSI - Dinas PUPR Kabupaten Temanggung";
  wb.created = new Date();

  // Nama sheet Excel maksimal 31 karakter dan tidak boleh memuat : \ / ? * [ ]
  const namaSheet = (berkas.nama_sheet || "Sheet1").replace(/[:\\/?*[\]]/g, " ").slice(0, 31);
  const ws = wb.addWorksheet(namaSheet);

  const kolom = berkas.kolom;
  ws.addRow(kolom);

  const kepala = ws.getRow(1);
  kepala.font = { bold: true };
  kepala.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  kepala.height = 28;
  for (let c = 1; c <= kolom.length; c++) {
    kepala.getCell(c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8EDF3" },
    };
    kepala.getCell(c).border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  }

  const kolomKode = berkas.kolom_kode;
  for (const b of baris) {
    // Kolom kode diambil dari `b.kode`, yang sejak migrasi 0012 berisi nomor
    // ASLI dari berkas draf. Dengan begitu berkas hasil ekspor benar-benar
    // sejajar dengan berkas sumbernya, nomor demi nomor.
    ws.addRow(
      kolom.map((nama) => (kolomKode && nama === kolomKode ? (b.kode ?? "") : (b.data[nama] ?? ""))),
    );
  }

  // Lebar kolom dari isi terpanjang, dibatasi supaya satu kolom catatan yang
  // kepanjangan tidak mendorong kolom lain keluar layar.
  for (let c = 1; c <= kolom.length; c++) {
    let lebar = kolom[c - 1].length;
    for (const b of baris) {
      const isi = kolomKode && kolom[c - 1] === kolomKode ? (b.kode ?? "") : b.data[kolom[c - 1]];
      const panjang = isi === null || isi === undefined ? 0 : String(isi).length;
      if (panjang > lebar) lebar = panjang;
      if (lebar >= 40) break;
    }
    ws.getColumn(c).width = Math.min(Math.max(lebar + 2, 8), 40);
  }

  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: kolom.length } };

  return wb.xlsx.writeBuffer();
}
