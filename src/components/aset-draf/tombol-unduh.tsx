"use client";

import { IkonExcel, Tombol } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { JenisAset } from "@/lib/supabase/types";

/**
 * Ekspor Excel menyusun ulang berkas dari database, jadi nomor asetnya sudah
 * terkodefikasi gaya SIKSI, berbeda dari nomor di berkas sumber GIS.
 *
 * Memakai <a download> biasa, bukan fetch + blob: unduhan ditangani browser,
 * jadi berkas 4.669 baris tidak perlu singgah di memori tab dulu.
 */
export function TombolUnduh({
  jenis,
  label,
  jumlahBaris,
}: {
  jenis: JenisAset;
  label: string;
  jumlahBaris: number;
}) {
  const toast = useToast();
  const kosong = jumlahBaris === 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
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
