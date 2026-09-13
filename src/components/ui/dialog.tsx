"use client";

import { useEffect, useRef } from "react";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Modal berbasis <dialog> bawaan browser — dapat penguncian fokus,
 * tombol Esc, dan inert latar belakang secara gratis.
 */
export function Dialog({
  buka,
  onTutup,
  judul,
  deskripsi,
  lebar = "max-w-lg",
  children,
}: {
  buka: boolean;
  onTutup: () => void;
  judul: string;
  deskripsi?: string;
  lebar?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (buka && !el.open) el.showModal();
    if (!buka && el.open) el.close();
  }, [buka]);

  return (
    <dialog
      ref={ref}
      onClose={onTutup}
      onClick={(e) => {
        // Klik pada area backdrop (target = elemen dialog itu sendiri) menutup modal.
        if (e.target === ref.current) onTutup();
      }}
      className={cn(
        // `m-auto` WAJIB: <dialog> mengandalkan `margin: auto` bawaan browser
        // untuk memusatkan diri, sedangkan Preflight Tailwind v4 menyetel
        // `margin: 0` ke semua elemen. Tanpa ini modal menempel di kiri atas.
        "m-auto w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl",
        "text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100",
        // Dialog yang isinya panjang (mis. form aset) tetap muat di layar.
        "max-h-[calc(100dvh-2rem)] overflow-y-auto",
        "backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm",
        lebar,
      )}
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{judul}</h2>
          {deskripsi ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{deskripsi}</p> : null}
        </div>
        <button
          type="button"
          onClick={onTutup}
          className="-mt-1 -mr-1 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
