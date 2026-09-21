"use client";

import Link from "next/link";

import { Plus } from "lucide-react";

import { BilahProgres, Lencana, Pemuat } from "@/components/ui";
import type { KartuPenilaian } from "@/lib/data/penilaian";
import { INFO_KATEGORI_IKSI, kategoriIksi } from "@/lib/iksi/scoring";
import { INFO_STATUS, nadaKategori } from "@/lib/tampilan";
import { formatAngka, formatTanggal } from "@/lib/utils";

/**
 * Luas baku apa adanya: bulat ditulis bulat, pecahan tetap dua desimal.
 * "65 Ha" dan "58,22 Ha" terbaca lebih cepat daripada "65,00 Ha".
 */
function luas(nilai: number | null): string {
  if (nilai === null) return "–";
  return formatAngka(nilai, Number.isInteger(nilai) ? 0 : 2);
}

function Identitas({ k, tampilkanUpt }: { k: KartuPenilaian; tampilkanUpt: boolean }) {
  const bawah = [k.kecamatan, tampilkanUpt ? k.uptNama : null].filter(Boolean).join(" · ");

  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-slate-800 group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-300">
        {k.nama}
      </p>
      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{bawah || "–"}</p>
    </div>
  );
}

function Kode({ k }: { k: KartuPenilaian }) {
  return (
    <span className="truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">
      {k.kode} · {luas(k.luasBaku)} Ha
    </span>
  );
}

/**
 * Satu D.I. pada papan penilaian, dalam dua bentuk yang sengaja dibedakan
 * sejak dari bingkainya: yang belum dinilai bergaris putus-putus dan bertanda
 * plus, yang sudah bergaris utuh dan membawa angkanya.
 *
 * Keduanya satu elemen klik penuh, bukan kartu berisi tombol kecil. Tombol di
 * dalam elemen yang juga bisa diklik menyulitkan keyboard dan pembaca layar,
 * dan di layar kecil sasaran sekecil itu gampang meleset.
 */
export function KartuDi({
  k,
  tampilkanUpt,
  menunggu,
  onMulai,
}: {
  k: KartuPenilaian;
  tampilkanUpt: boolean;
  menunggu: boolean;
  onMulai: () => void;
}) {
  if (k.penilaianId === null) {
    return (
      <button
        type="button"
        onClick={onMulai}
        disabled={menunggu}
        aria-label={`Mulai penilaian ${k.nama}`}
        className="group flex h-full flex-col gap-3 rounded-card border border-dashed border-slate-300 p-4 text-left transition-colors hover:border-brand-400 hover:bg-brand-50/60 disabled:cursor-wait dark:border-slate-700 dark:hover:border-brand-600 dark:hover:bg-brand-500/10"
      >
        <div className="flex items-start justify-between gap-3">
          <Identitas k={k} tampilkanUpt={tampilkanUpt} />
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors group-hover:bg-brand-100 group-hover:text-brand-600 dark:bg-slate-800 dark:text-slate-500 dark:group-hover:bg-brand-500/20 dark:group-hover:text-brand-300">
            {menunggu ? <Pemuat /> : <Plus className="h-4 w-4" aria-hidden />}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-dashed border-slate-200 pt-2.5 dark:border-slate-800">
          <Kode k={k} />
          <span className="shrink-0 text-[11px] font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:text-brand-300">
            {menunggu ? "Membuat…" : "Mulai nilai"}
          </span>
        </div>
      </button>
    );
  }

  const kat = k.total === null ? null : kategoriIksi(k.total);
  const terisi = k.jmlTerisi ?? 0;
  const dari = k.jmlIndikator ?? 0;
  const lengkap = dari > 0 && terisi >= dari;
  const info = k.status ? INFO_STATUS[k.status] : null;

  return (
    <Link
      href={`/penilaian/${k.penilaianId}`}
      className="kartu group flex h-full flex-col gap-3 p-4 shadow-sm transition-all hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
    >
      <div className="flex items-start justify-between gap-3">
        <Identitas k={k} tampilkanUpt={tampilkanUpt} />
        {kat ? (
          <Lencana
            nada={nadaKategori(kat)}
            title={INFO_KATEGORI_IKSI[kat].label}
            className="shrink-0 rounded-lg px-2.5 py-1 text-sm font-semibold tabular-nums"
          >
            {formatAngka(k.total, 1)}
          </Lencana>
        ) : (
          <span
            className="shrink-0 px-2.5 py-1 text-sm text-slate-300 dark:text-slate-600"
            title="Belum ada nilai"
          >
            –
          </span>
        )}
      </div>

      <div className="mt-auto">
        <BilahProgres
          nilai={terisi}
          maks={dari || 1}
          warnaBilah={lengkap ? "bg-emerald-500" : "bg-brand-600"}
        />
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="tabular-nums">
            {terisi}/{dari || "–"} indikator
          </span>
          <span className="truncate">{formatTanggal(k.diperbarui)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
        <Kode k={k} />
        {info ? (
          <Lencana nada={info.nada} className="shrink-0">
            {info.label}
          </Lencana>
        ) : null}
      </div>
    </Link>
  );
}
