"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Input, KosongData, Tombol } from "@/components/ui";
import { selDraf } from "@/lib/aset-draf";
import type { AsetDraf } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/** Lebar kolom nomor baris; dipakai juga sebagai offset kolom lengket kedua. */
const W_NOMOR = "3rem";

export function TabelDraf({
  baris,
  kolom,
  kolomKode,
  total,
  halaman,
  perHalaman,
  cari,
}: {
  baris: AsetDraf[];
  kolom: string[];
  /** Kolom yang isinya diganti nomor aset hasil kodefikasi. */
  kolomKode: string | null;
  total: number;
  halaman: number;
  perHalaman: number;
  cari: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, mulai] = useTransition();
  const [teks, setTeks] = useState(cari);

  function terapkan(patch: Record<string, string>) {
    const p = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    if (!("hal" in patch)) p.delete("hal");
    mulai(() => router.push(`${pathname}?${p}`));
  }

  useEffect(() => {
    if (teks === cari) return;
    const t = setTimeout(() => terapkan({ cari: teks }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teks]);

  const jmlHalaman = Math.max(1, Math.ceil(total / perHalaman));
  const awal = total === 0 ? 0 : (halaman - 1) * perHalaman + 1;
  const akhir = Math.min(halaman * perHalaman, total);

  /**
   * Nilai satu sel.
   *
   * Kolom nomor aset diambil dari `b.kode`, yang sejak migrasi 0012 berisi
   * nomor ASLI dari berkas draf — sama dengan `b.data`, tetapi sudah
   * dibakukan spasinya. Nomor bentukan sistem tidak ditampilkan di mana pun.
   */
  function nilai(b: AsetDraf, nama: string): string {
    if (kolomKode && nama === kolomKode) return b.kode ?? "";
    return selDraf(b.data[nama]);
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            placeholder="Cari nomenklatur, nama aset, nomor, atau D.I.…"
            className="pl-9"
            aria-label="Cari data draf"
          />
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {kolom.length} kolom · geser mendatar untuk melihat semuanya
        </span>
      </div>

      {baris.length === 0 ? (
        <div className="kartu dark:border-slate-800 dark:bg-slate-900">
          <KosongData
            judul="Tidak ada baris yang cocok"
            pesan={
              cari
                ? `Pencarian "${cari}" tidak menemukan apa pun di berkas ini.`
                : "Berkas draf ini belum berisi data."
            }
          />
        </div>
      ) : (
        <>
          {/*
            Dua sumbu gulir sekaligus: mendatar untuk 62 kolom, menegak untuk
            50 baris. Header dan dua kolom pertama dibuat lengket supaya
            konteks baris tidak hilang saat digeser jauh ke kanan.
          */}
          <div className="kartu overflow-auto dark:border-slate-800 dark:bg-slate-900">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-max min-w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60">
                    <th
                      scope="col"
                      className="sticky top-0 left-0 z-30 border-r border-b border-slate-200 bg-slate-50 px-2 py-2.5 text-right font-medium text-slate-400 dark:border-slate-800 dark:bg-slate-800"
                      style={{ width: W_NOMOR, minWidth: W_NOMOR }}
                    >
                      #
                    </th>
                    {kolom.map((nama, i) => (
                      <th
                        key={nama}
                        scope="col"
                        className={cn(
                          "sticky top-0 z-20 border-b border-slate-200 px-3 py-2.5 text-left font-semibold whitespace-nowrap text-slate-600",
                          "bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300",
                          i === 0 &&
                            "left-12 z-30 border-r border-slate-200 dark:border-slate-800",
                          kolomKode === nama && "text-brand-700 dark:text-brand-400",
                        )}
                      >
                        {nama}
                        {kolomKode === nama ? (
                          <span
                            className="ml-1.5 font-normal text-brand-500"
                            title="Sudah memakai kodefikasi golongan + UPT"
                          >
                            ✓
                          </span>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {baris.map((b, iBaris) => (
                    <tr
                      key={b.id}
                      className="group border-b border-slate-100 last:border-0 hover:bg-brand-50/40 dark:border-slate-800/70 dark:hover:bg-slate-800/40"
                    >
                      <td
                        className="sticky left-0 z-10 border-r border-slate-200 bg-white px-2 py-2 text-right text-[11px] text-slate-400 tabular-nums group-hover:bg-brand-50/40 dark:border-slate-800 dark:bg-slate-900 dark:group-hover:bg-slate-800/40"
                        style={{ width: W_NOMOR, minWidth: W_NOMOR }}
                      >
                        {awal + iBaris}
                      </td>
                      {kolom.map((nama, i) => {
                        const isi = nilai(b, nama);
                        return (
                          <td
                            key={nama}
                            title={isi.length > 28 ? isi : undefined}
                            className={cn(
                              "max-w-[16rem] truncate px-3 py-2 text-slate-700 dark:text-slate-300",
                              i === 0 &&
                                "sticky left-12 z-10 border-r border-slate-200 bg-white font-medium text-slate-900 group-hover:bg-brand-50/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:group-hover:bg-slate-800/40",
                              kolomKode === nama && "font-mono text-[11px] text-brand-700 dark:text-brand-400",
                            )}
                          >
                            {isi || <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Menampilkan {awal.toLocaleString("id-ID")}–{akhir.toLocaleString("id-ID")} dari{" "}
              {total.toLocaleString("id-ID")} baris
            </span>
            <div className="flex items-center gap-1.5">
              <Tombol
                varian="garis"
                ukuran="sm"
                disabled={halaman <= 1}
                onClick={() => terapkan({ hal: String(halaman - 1) })}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
              </Tombol>
              <span className="px-2 text-xs text-slate-500">
                {halaman} / {jmlHalaman}
              </span>
              <Tombol
                varian="garis"
                ukuran="sm"
                disabled={halaman >= jmlHalaman}
                onClick={() => terapkan({ hal: String(halaman + 1) })}
              >
                Berikutnya <ChevronRight className="h-3.5 w-3.5" />
              </Tombol>
            </div>
          </div>
        </>
      )}
    </>
  );
}
