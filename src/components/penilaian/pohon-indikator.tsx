"use client";

import { Boxes, ChevronRight } from "lucide-react";

import {
  JENIS_UNTUK_KELOMPOK,
  KODE_KELOMPOK_PER_UNIT,
} from "@/lib/iksi/per-bangunan";
import { ANAK_BY_PARENT, NODE_BY_KODE, bobotEfektif, isRelevan } from "@/lib/iksi/scoring";
import type { KantongLumpur, NilaiInput } from "@/lib/iksi/types";
import { JENIS_ASET } from "@/lib/aset";
import type { JenisAset } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

import { KartuIndikator } from "./kartu-indikator";

/** Indentasi kiri per kedalaman, dibatasi agar tidak terlalu menjorok di mobile. */
const INDEN = ["", "", "sm:pl-3", "sm:pl-6", "sm:pl-9", "sm:pl-12"];

export interface PohonIndikatorProps {
  kodeAkar: string;
  nilai: NilaiInput;
  keterangan: Record<string, string>;
  nilaiNode: ReadonlyMap<string, number | null>;
  kantongLumpur: KantongLumpur;
  terkunci: boolean;
  onUbah: (kode: string, nilai: number | null) => void;
  onUbahKeterangan: (kode: string, teks: string) => void;
  /**
   * Berapa bangunan tiap jenis yang sudah dinilai tuntas, untuk ditampilkan
   * pada kartu penunjuk. `[selesai, total]`.
   */
  kelengkapanJenis?: ReadonlyMap<JenisAset, [number, number]>;
  /** Membuka tab penilaian per bangunan pada jenis tertentu. */
  onBukaPerBangunan?: (jenis: JenisAset) => void;
}

export function PohonIndikator(props: PohonIndikatorProps) {
  const anak = ANAK_BY_PARENT.get(props.kodeAkar) ?? [];
  return (
    <div className="space-y-3">
      {anak.map((kode) => (
        <Cabang key={kode} kode={kode} {...props} />
      ))}
    </div>
  );
}

function Cabang({ kode, ...p }: PohonIndikatorProps & { kode: string }) {
  const node = NODE_BY_KODE.get(kode);
  if (!node) return null;

  const relevan = isRelevan(node, p.kantongLumpur);
  const bobot = bobotEfektif(node, p.kantongLumpur);

  // Sub-pohon yang bobotnya nol pada skenario ini tidak ditampilkan sama sekali:
  // menampilkannya hanya membingungkan penilai karena tak berpengaruh ke skor.
  if (!relevan) return null;

  // Kelompok yang dinilai per bangunan tidak dirender isinya di sini. Kartu
  // indikatornya ada di tab "Per Bangunan", satu set untuk tiap bangunan.
  // Menampilkannya di sini akan mengundang penilai mengisi angka yang kemudian
  // dibuang server, karena nilai kelompok ini datang dari rata-rata.
  if (KODE_KELOMPOK_PER_UNIT.has(kode)) {
    return (
      <KartuPenunjukPerBangunan
        kode={kode}
        label={node.label}
        nomor={node.nomor}
        bobotLabel={node.bobotLabel}
        bobot={bobot}
        nilaiNode={p.nilaiNode.get(kode) ?? null}
        kedalaman={Math.min(node.level, INDEN.length - 1)}
        kelengkapanJenis={p.kelengkapanJenis}
        onBuka={p.onBukaPerBangunan}
      />
    );
  }

  if (node.agregasi === "leaf") {
    return (
      <KartuIndikator
        node={node}
        bobot={bobot}
        nilai={p.nilai[kode] ?? null}
        keterangan={p.keterangan[kode] ?? ""}
        terkunci={p.terkunci}
        onUbah={(v) => p.onUbah(kode, v)}
        onUbahKeterangan={(t) => p.onUbahKeterangan(kode, t)}
      />
    );
  }

  const anak = ANAK_BY_PARENT.get(kode) ?? [];
  const nilaiNode = p.nilaiNode.get(kode);
  const kedalaman = Math.min(node.level, INDEN.length - 1);

  return (
    <section className={cn(INDEN[kedalaman])}>
      <header
        className={cn(
          "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1",
          node.level <= 2
            ? "mb-3 border-b border-slate-200 pb-2"
            : "mb-2.5",
        )}
      >
        <h3 className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-mono text-xs",
              node.level <= 2 ? "text-brand-600" : "text-slate-400",
            )}
          >
            {node.nomor}
          </span>
          <span
            className={cn(
              node.level <= 2
                ? "text-sm font-semibold text-slate-900"
                : "text-[13px] font-medium text-slate-700",
            )}
          >
            {node.label}
          </span>
        </h3>
        <p className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
          <span>bobot {node.bobotLabel}</span>
          <span className="text-slate-300">·</span>
          <span className={cn(nilaiNode != null && "font-medium text-slate-600")}>
            {nilaiNode == null ? "belum dinilai" : `${nilaiNode.toFixed(3)} / ${bobot}`}
          </span>
        </p>
      </header>

      <div className={cn(node.level <= 2 ? "space-y-4" : "space-y-3")}>
        {anak.map((k) => (
          <Cabang key={k} kode={k} {...p} />
        ))}
      </div>
    </section>
  );
}

/**
 * Pengganti sub-pohon yang dinilai per bangunan.
 *
 * Menjelaskan kenapa indikatornya tidak ada di sini, menunjukkan nilai
 * rata-rata yang sudah terbentuk, dan mengantar penilai ke tempat mengisinya.
 */
function KartuPenunjukPerBangunan({
  kode,
  label,
  nomor,
  bobotLabel,
  bobot,
  nilaiNode,
  kedalaman,
  kelengkapanJenis,
  onBuka,
}: {
  kode: string;
  label: string;
  nomor: string;
  bobotLabel: string;
  bobot: number;
  nilaiNode: number | null;
  kedalaman: number;
  kelengkapanJenis?: ReadonlyMap<JenisAset, [number, number]>;
  onBuka?: (jenis: JenisAset) => void;
}) {
  const jenisPengisi = JENIS_UNTUK_KELOMPOK.get(kode) ?? [];

  // Tanggul diisi saluran dan bangunan pengaman sekaligus, jadi angkanya
  // dijumlahkan dari kedua jenis, bukan diambil salah satu.
  let selesai = 0;
  let total = 0;
  for (const j of jenisPengisi) {
    const p = kelengkapanJenis?.get(j);
    if (!p) continue;
    selesai += p[0];
    total += p[1];
  }

  const jenisUtama = jenisPengisi.find((j) => (kelengkapanJenis?.get(j)?.[1] ?? 0) > 0);

  return (
    <section className={cn(INDEN[kedalaman])}>
      <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="flex items-baseline gap-2">
            <span className="font-mono text-xs text-slate-400">{nomor}</span>
            <span className="text-[13px] font-medium text-slate-700">{label}</span>
          </h3>
          <p className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span>bobot {bobotLabel}</span>
            <span className="text-slate-300">·</span>
            <span className={cn(nilaiNode != null && "font-medium text-slate-600")}>
              {nilaiNode == null ? "belum dinilai" : `${nilaiNode.toFixed(3)} / ${bobot}`}
            </span>
          </p>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
            <Boxes className="mt-px h-4 w-4 shrink-0 text-brand-500" aria-hidden />
            <span>
              Dinilai per bangunan, lalu dirata-rata.{" "}
              {total > 0 ? (
                <strong className="font-medium text-slate-700">
                  {selesai} dari {total} bangunan sudah dinilai.
                </strong>
              ) : (
                <span className="text-slate-400">
                  Belum ada {jenisPengisi.map((j) => JENIS_ASET[j].singkat.toLowerCase()).join(" atau ")}{" "}
                  terdaftar di D.I. ini.
                </span>
              )}
            </span>
          </p>

          {onBuka && jenisUtama ? (
            <button
              type="button"
              onClick={() => onBuka(jenisUtama)}
              className="flex shrink-0 items-center gap-1 rounded-md border border-brand-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-brand-700 transition-colors hover:border-brand-400 hover:bg-brand-50"
            >
              Isi per bangunan
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
