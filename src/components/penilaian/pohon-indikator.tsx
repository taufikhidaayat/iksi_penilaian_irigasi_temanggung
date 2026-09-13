"use client";

import { ANAK_BY_PARENT, NODE_BY_KODE, bobotEfektif, isRelevan } from "@/lib/iksi/scoring";
import type { KantongLumpur, NilaiInput } from "@/lib/iksi/types";
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
