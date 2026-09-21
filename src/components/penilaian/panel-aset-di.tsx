"use client";

import { useState } from "react";

import { Boxes, ChevronDown, Info } from "lucide-react";

import { JENIS_ASET, urutanJenis, letakAset, ruasAset } from "@/lib/aset";
import type { JenisAset } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export interface AsetRingkas {
  id: number;
  nomenklatur: string | null;
  nama: string;
  /** Nomor aset ASLI dari buku — nomor yang sama dengan berkas cetak petugas. */
  kode: string | null;
  desa: string | null;
  kecamatan: string | null;
  /** Khusus saluran: bangunan di hulu dan hilirnya, pembeda antar-ruas. */
  bangunan_hulu: string | null;
  bangunan_hilir: string | null;
  /** Nama D.I. sebagaimana tertulis di buku, untuk memergoki salah tautan. */
  nama_di_buku: string | null;
  perlu_tinjau: boolean;
}

export interface KelompokAset {
  jenis: JenisAset;
  daftar: AsetRingkas[];
}

/**
 * Gambaran isi register aset milik satu D.I., ditampilkan di dalam form.
 *
 * Penilaiannya sendiri dikerjakan per bangunan di tab **Per Bangunan**; panel
 * ini sekadar memperlihatkan apa saja yang terdaftar, supaya penilai tahu
 * cakupan yang akan ia periksa sebelum mulai.
 *
 * Tiap baris memuat ruas hulu-hilir dan nomor aset aslinya, bukan nama saja:
 * seluruh saluran di register bernama "Saluran Sekunder", jadi nama tidak
 * membedakan apa pun.
 */
export function PanelAsetDi({
  kelompok,
  sorot,
}: {
  kelompok: KelompokAset[];
  /** Jenis yang paling relevan dengan komponen penilaian yang sedang dibuka. */
  sorot?: JenisAset[];
}) {
  const [terbuka, setTerbuka] = useState<JenisAset | null>(sorot?.[0] ?? null);

  if (kelompok.length === 0) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-3.5 py-3 text-xs text-slate-600">
        <Info className="mt-px h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span>
          Belum ada data aset untuk D.I. ini. Register aset bisa dilengkapi di menu{" "}
          <strong>Aset Irigasi</strong>.
        </span>
      </div>
    );
  }

  const urut = [...kelompok].sort(
    (a, b) => urutanJenis(a.jenis) - urutanJenis(b.jenis),
  );
  const total = kelompok.reduce((a, k) => a + k.daftar.length, 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <p className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-slate-700">
        <Boxes className="h-4 w-4 text-slate-400" aria-hidden />
        Aset terdaftar di D.I. ini
        <span className="font-normal text-slate-400">({total} aset)</span>
      </p>

      <div className="flex flex-wrap gap-1.5">
        {urut.map((k) => {
          const disorot = sorot?.includes(k.jenis);
          const aktif = terbuka === k.jenis;
          return (
            <button
              key={k.jenis}
              type="button"
              onClick={() => setTerbuka(aktif ? null : k.jenis)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors",
                aktif
                  ? "border-brand-600 bg-brand-600 text-white"
                  : disorot
                    ? "border-brand-300 bg-white text-brand-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {JENIS_ASET[k.jenis].label}
              <span
                className={cn(
                  "rounded px-1 font-mono tabular-nums",
                  aktif ? "bg-white/20" : "bg-slate-100 text-slate-600",
                )}
              >
                {k.daftar.length}
              </span>
              <ChevronDown
                className={cn("h-3 w-3 transition-transform", aktif && "rotate-180")}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      {terbuka ? (
        <div className="scroll-halus mt-2.5 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {(urut.find((k) => k.jenis === terbuka)?.daftar ?? []).map((a) => {
              const ruas = ruasAset(a);
              const letak = letakAset(a);
              return (
                <li key={a.id} className="px-3 py-1.5 text-xs">
                  <div className="flex items-baseline gap-2">
                    {a.nomenklatur ? (
                      <code className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-brand-700">
                        {a.nomenklatur}
                      </code>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-slate-700">{a.nama}</span>
                    <span className="shrink-0 text-slate-400">{letak ?? "letak belum dicatat"}</span>
                  </div>
                  {/* Ruas dan nomor aset ditaruh di baris kedua: pada D.I. yang
                      seluruh salurannya bernama "Saluran Sekunder", inilah yang
                      membedakan satu ruas dari ruas berikutnya. */}
                  {ruas || a.kode ? (
                    <div className="mt-0.5 flex items-baseline gap-2 text-[10px] text-slate-400">
                      {ruas ? <span className="min-w-0 truncate">{ruas}</span> : null}
                      {a.kode ? <span className="ml-auto shrink-0 font-mono">{a.kode}</span> : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Bangunan dinilai satu per satu di tab <strong>Per Bangunan</strong>, lalu hasilnya
        dirata-rata menjadi nilai indikator. Daftar ini sekadar gambaran isi register aset D.I. ini.
      </p>
    </div>
  );
}
