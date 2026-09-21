"use client";

import { IkonExcel, Tombol } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { JenisAset } from "@/lib/supabase/types";

/**
 * Dua bentuk unduhan untuk satu jenis draf.
 *
 * "Ekspor Excel" menyusun ulang berkas dari database, jadi nomor asetnya sudah
 * terkodefikasi. "Berkas asli" mengirim .xlsx draf apa adanya, untuk saat
 * perlu membandingkan dengan sumbernya.
 *
 * Memakai <a download> biasa, bukan fetch + blob: unduhan ditangani browser,
 * jadi berkas 4.669 baris tidak perlu singgah di memori tab dulu.
 */
export function TombolUnduh({
  jenis,
  label,
  jumlahBaris,
  namaBerkasAsli,
}: {
  jenis: JenisAset;
  label: string;
  jumlahBaris: number;
  namaBerkasAsli: string;
}) {
  const toast = useToast();
  const kosong = jumlahBaris === 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`/api/aset-draf/${jenis}?asli=1`}
        onClick={() => toast.info("Menyiapkan berkas", `Mengunduh ${namaBerkasAsli}.`)}
        aria-disabled={kosong}
        className={kosong ? "pointer-events-none opacity-50" : undefined}
      >
        {/*
          Tetap varian "garis" walau isinya .xlsx juga: dua tombol hijau
          berdampingan membuat keduanya sama menonjol, padahal yang dituju
          petugas hampir selalu Ekspor Excel. Ikonnya yang membawa warna Excel.
        */}
        <Tombol varian="garis" disabled={kosong}>
          <IkonExcel className="text-excel-600" />
          Berkas asli
        </Tombol>
      </a>

      <a
        href={`/api/aset-draf/${jenis}`}
        onClick={() =>
          toast.info(
            "Menyiapkan berkas",
            `${label}, ${jumlahBaris.toLocaleString("id-ID")} baris. Unduhan akan dimulai sebentar lagi.`,
          )
        }
        aria-disabled={kosong}
        className={kosong ? "pointer-events-none opacity-50" : undefined}
      >
        <Tombol varian="excel" disabled={kosong}>
          <IkonExcel />
          Ekspor Excel
        </Tombol>
      </a>
    </div>
  );
}
