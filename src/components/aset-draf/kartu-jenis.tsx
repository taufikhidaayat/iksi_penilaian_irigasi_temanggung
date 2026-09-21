import Link from "next/link";

import { ArrowRight, type LucideIcon } from "lucide-react";

import { JENIS_ASET } from "@/lib/aset";
import type { JenisAset } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export interface IsiKartuJenis {
  jenis: JenisAset;
  /** Identitas berbeda: inilah angka besar di kartu, sama seperti menu Aset. */
  jumlahAset: number;
  /** Baris berkas. Jadi keterangan, dan hanya ditampilkan bila berbeda. */
  jumlahBaris: number;
  /** Berapa D.I. yang diwakili jenis ini. */
  jumlahDi: number;
  jumlahKolom: number;
  namaBerkas: string;
  ikon: LucideIcon;
  /** Aset tanah dibedakan warnanya, seperti golongan 02 pada nomor asetnya. */
  tanah: boolean;
}

/**
 * Kartu satu jenis aset draf.
 *
 * Seluruh kartu adalah tautan, bukan hanya tulisannya: sasaran sentuh sebesar
 * kartu jauh lebih mudah dikenai di layar sentuh, dan tidak ada aksi lain di
 * dalam kartu yang bisa bertabrakan dengannya.
 */
export function KartuJenis({ isi }: { isi: IsiKartuJenis }) {
  const info = JENIS_ASET[isi.jenis];
  const Ikon = isi.ikon;
  const kosong = isi.jumlahBaris === 0;

  return (
    <Link
      href={`/aset-draf/${isi.jenis}`}
      className={cn(
        "kartu group relative flex flex-col gap-4 p-5 shadow-sm transition-all",
        "dark:border-slate-800 dark:bg-slate-900",
        "hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md",
        "focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:outline-none",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
            isi.tanah
              ? "bg-amber-50 text-amber-600 group-hover:bg-amber-100 dark:bg-amber-500/10"
              : "bg-brand-50 text-brand-600 group-hover:bg-brand-100 dark:bg-brand-500/10",
          )}
        >
          <Ikon className="h-5 w-5" aria-hidden />
        </div>
        <span
          className={cn(
            "rounded-md px-2 py-0.5 font-mono text-[11px] font-medium",
            isi.tanah
              ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
          )}
          title={`Kode tipe pada nomor aset: ${info.kodeTipe}`}
        >
          {info.kodeTipe}
        </span>
      </div>

      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {info.label}
        </h2>
        {/*
          Satuannya "aset", bukan "baris", dan angkanya jumlah identitas yang
          berbeda — sama persis dengan kartu di menu Aset Irigasi. Dua menu yang
          menghitung hal yang sama dengan satuan berbeda adalah sumber salah
          paham yang tidak perlu.

          Jumlah D.I. ikut disebut karena tanpa itu kartunya tidak bisa
          dijelaskan: nomor D.I. hanya sampai 577, sedangkan Bendung Baru memuat
          584 aset. Begitu tertulis "575 D.I.", selisihnya terbaca sebagai
          beberapa D.I. yang punya lebih dari satu bangunan, bukan salah hitung.
        */}
        <p className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {isi.jumlahAset.toLocaleString("id-ID")}
          </span>
          <span className="text-xs font-medium text-slate-400">aset</span>
        </p>
        <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
          {isi.jumlahDi.toLocaleString("id-ID")} D.I.
          {isi.jumlahBaris !== isi.jumlahAset ? (
            <span className="text-amber-600 dark:text-amber-500">
              {" "}
              · {isi.jumlahBaris.toLocaleString("id-ID")} baris
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
          {isi.jumlahKolom} kolom · {isi.namaBerkas}
        </p>
      </div>

      {/*
        Bentuk pil yang sama dengan tautan "Lihat rekapitulasi" di Dasbor.
        Sengaja <span>, bukan tombol: seluruh kartu sudah jadi satu tautan, dan
        menaruh kontrol lain di dalamnya hanya menghasilkan sasaran klik ganda.

        Hanya muncul saat kartu disentuh kursor atau difokus keyboard, supaya
        delapan kartu berjajar tidak jadi ramai. Tiga hal yang dijaga:
        - ruangnya tetap dipesan (opacity, bukan hidden), jadi tinggi kartu
          tidak melonjak saat kursor lewat;
        - `group-focus-visible` menjaga pengguna keyboard tetap kebagian;
        - `hover:hover` dipakai eksplisit karena varian `hover:` Tailwind sudah
          dibungkus media itu — tanpa ini, di layar sentuh pilnya tersembunyi
          selamanya sebab hover tidak pernah terjadi di sana.
      */}
      <span
        className={cn(
          "mt-auto inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
          "transition-[opacity,background-color] duration-150",
          "[@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
          kosong
            ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            : "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200",
        )}
      >
        {kosong ? "Belum ada data" : "Lihat & ekspor"}
        {kosong ? null : <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
      </span>
    </Link>
  );
}
