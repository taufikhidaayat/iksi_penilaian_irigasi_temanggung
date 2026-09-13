"use client";

import { type CSSProperties, memo, useId, useState } from "react";

import { MessageSquarePlus, X } from "lucide-react";

import { INFO_KATEGORI_KONDISI, kategoriKondisi } from "@/lib/iksi/scoring";
import type { IndikatorNode, KategoriKondisi } from "@/lib/iksi/types";
import { cn } from "@/lib/utils";

/**
 * Nilai awal saat penilai mengklik salah satu kategori kondisi.
 * Sekadar titik mulai di dalam rentang kategori — penilai tetap bisa
 * menggeser ke angka pastinya.
 */
const NILAI_AWAL: Record<KategoriKondisi, number> = {
  JELEK: 50,
  SEDANG: 70,
  BAIK: 85,
  BAIK_SEKALI: 95,
};

const URUTAN: KategoriKondisi[] = ["JELEK", "SEDANG", "BAIK", "BAIK_SEKALI"];

const GAYA_KARTU: Record<KategoriKondisi, { aktif: string; titik: string }> = {
  JELEK: { aktif: "border-rose-500 bg-rose-50 ring-1 ring-rose-500", titik: "bg-rose-500" },
  SEDANG: { aktif: "border-amber-500 bg-amber-50 ring-1 ring-amber-500", titik: "bg-amber-500" },
  BAIK: { aktif: "border-sky-500 bg-sky-50 ring-1 ring-sky-500", titik: "bg-sky-500" },
  BAIK_SEKALI: {
    aktif: "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500",
    titik: "bg-emerald-500",
  },
};

const WARNA_SLIDER: Record<KategoriKondisi, string> = {
  JELEK: "#f43f5e",
  SEDANG: "#f59e0b",
  BAIK: "#0ea5e9",
  BAIK_SEKALI: "#10b981",
};

export interface KartuIndikatorProps {
  node: IndikatorNode;
  nilai: number | null;
  keterangan: string;
  bobot: number;
  terkunci: boolean;
  onUbah: (nilai: number | null) => void;
  onUbahKeterangan: (teks: string) => void;
}

export const KartuIndikator = memo(function KartuIndikator({
  node,
  nilai,
  keterangan,
  bobot,
  terkunci,
  onUbah,
  onUbahKeterangan,
}: KartuIndikatorProps) {
  const idSlider = useId();
  const [bukaCatatan, setBukaCatatan] = useState(Boolean(keterangan));
  const kategori = nilai === null ? null : kategoriKondisi(nilai);
  const kondisi = node.kondisi;

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 transition-colors",
        nilai === null ? "border-slate-200" : "border-slate-300",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="shrink-0 font-mono text-xs text-slate-400">{node.nomor}.</span>
          <p className="text-sm leading-snug font-medium text-slate-800">{node.label}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
            bobot {node.bobotLabel}
          </span>
          {nilai !== null ? (
            <span className="font-mono text-xs tabular-nums text-slate-500">
              → {((bobot * nilai) / 100).toFixed(3)}
            </span>
          ) : null}
        </div>
      </div>

      {node.catatan && !node.catatan.startsWith("*)") ? (
        <p className="mt-1.5 ml-6 text-xs text-slate-500 italic">{node.catatan}</p>
      ) : null}

      {/* Empat deskriptor kondisi — klik untuk menilai cepat. */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {URUTAN.map((k) => {
          const info = INFO_KATEGORI_KONDISI[k];
          const teks = kondisi
            ? k === "JELEK"
              ? kondisi.jelek
              : k === "SEDANG"
                ? kondisi.sedang
                : k === "BAIK"
                  ? kondisi.baik
                  : kondisi.baikSekali
            : null;
          const dipilih = kategori === k;

          return (
            <button
              key={k}
              type="button"
              disabled={terkunci}
              aria-pressed={dipilih}
              onClick={() => onUbah(dipilih ? null : NILAI_AWAL[k])}
              className={cn(
                "rounded-lg border p-2.5 text-left transition-all",
                "disabled:cursor-not-allowed disabled:opacity-60",
                dipilih
                  ? GAYA_KARTU[k].aktif
                  : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white",
              )}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    dipilih ? GAYA_KARTU[k].titik : "bg-slate-300",
                  )}
                />
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    dipilih ? "text-slate-800" : "text-slate-500",
                  )}
                >
                  {info.label}
                </span>
                <span className="ml-auto font-mono text-[10px] text-slate-400">{info.rentang}</span>
              </span>
              <span className="mt-1 block text-xs leading-snug text-slate-600">{teks ?? "—"}</span>
            </button>
          );
        })}
      </div>

      {/* Penyetel halus */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label htmlFor={idSlider} className="text-xs text-slate-500">
          Nilai
        </label>
        <input
          id={idSlider}
          type="range"
          min={0}
          max={100}
          step={1}
          disabled={terkunci || nilai === null}
          value={nilai ?? 0}
          onChange={(e) => onUbah(Number(e.target.value))}
          className="slider-nilai min-w-35 flex-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          style={
            {
              "--warna-slider": kategori ? WARNA_SLIDER[kategori] : "#94a3b8",
              "--isi-slider": `${nilai ?? 0}%`,
            } as CSSProperties
          }
        />
        <input
          type="number"
          min={0}
          max={100}
          disabled={terkunci}
          value={nilai ?? ""}
          placeholder="–"
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") return onUbah(null);
            const n = Math.max(0, Math.min(100, Math.round(Number(v))));
            onUbah(Number.isNaN(n) ? null : n);
          }}
          className="h-8 w-16 rounded-lg border border-slate-300 px-2 text-center text-sm tabular-nums focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none disabled:bg-slate-50"
          aria-label={`Nilai ${node.label}`}
        />
        <span className="text-xs text-slate-400">%</span>

        <button
          type="button"
          disabled={terkunci}
          onClick={() => {
            if (bukaCatatan) onUbahKeterangan("");
            setBukaCatatan((v) => !v);
          }}
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
        >
          {bukaCatatan ? <X className="h-3.5 w-3.5" /> : <MessageSquarePlus className="h-3.5 w-3.5" />}
          {bukaCatatan ? "Hapus catatan" : "Catatan"}
        </button>
      </div>

      {bukaCatatan ? (
        <input
          type="text"
          value={keterangan}
          disabled={terkunci}
          onChange={(e) => onUbahKeterangan(e.target.value)}
          placeholder="Catatan lapangan untuk indikator ini…"
          className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-xs focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
        />
      ) : null}
    </div>
  );
});
