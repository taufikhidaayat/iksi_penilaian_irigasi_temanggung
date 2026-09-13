"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export type JenisToast = "sukses" | "galat" | "info" | "peringatan";

export interface OpsiToast {
  judul: string;
  pesan?: string;
  jenis?: JenisToast;
  /** Milidetik sebelum hilang sendiri. 0 = menetap sampai ditutup. */
  durasi?: number;
}

interface Toast extends Required<Omit<OpsiToast, "pesan">> {
  id: number;
  pesan?: string;
}

const GAYA: Record<
  JenisToast,
  {
    ikon: typeof CheckCircle2;
    garis: string;
    warnaIkon: string;
    bilah: string;
    hoverTutup: string;
    peran: "status" | "alert";
  }
> = {
  sukses: {
    ikon: CheckCircle2,
    garis: "border-l-emerald-500",
    warnaIkon: "text-emerald-600",
    bilah: "bg-emerald-500",
    hoverTutup: "hover:bg-emerald-500 hover:text-white",
    peran: "status",
  },
  galat: {
    ikon: XCircle,
    garis: "border-l-rose-500",
    warnaIkon: "text-rose-600",
    bilah: "bg-rose-500",
    hoverTutup: "hover:bg-rose-500 hover:text-white",
    peran: "alert",
  },
  peringatan: {
    ikon: AlertTriangle,
    garis: "border-l-amber-500",
    warnaIkon: "text-amber-600",
    bilah: "bg-amber-500",
    hoverTutup: "hover:bg-amber-500 hover:text-white",
    peran: "alert",
  },
  info: {
    ikon: Info,
    garis: "border-l-brand-500",
    warnaIkon: "text-brand-600",
    bilah: "bg-brand-500",
    hoverTutup: "hover:bg-brand-500 hover:text-white",
    peran: "status",
  },
};

interface KonteksToast {
  tampilkan: (opsi: OpsiToast) => void;
  sukses: (judul: string, pesan?: string) => void;
  galat: (judul: string, pesan?: string) => void;
  info: (judul: string, pesan?: string) => void;
  peringatan: (judul: string, pesan?: string) => void;
}

const Konteks = createContext<KonteksToast | null>(null);

export function useToast(): KonteksToast {
  const k = useContext(Konteks);
  if (!k) throw new Error("useToast harus dipakai di dalam <PenyediaToast>.");
  return k;
}

export function PenyediaToast({ children }: { children: React.ReactNode }) {
  const [daftar, setDaftar] = useState<Toast[]>([]);
  const berikutnya = useRef(0);

  const tutup = useCallback((id: number) => {
    setDaftar((s) => s.filter((t) => t.id !== id));
  }, []);

  const tampilkan = useCallback((opsi: OpsiToast) => {
    const id = ++berikutnya.current;
    setDaftar((s) => [
      {
        id,
        judul: opsi.judul,
        pesan: opsi.pesan,
        jenis: opsi.jenis ?? "info",
        durasi: opsi.durasi ?? (opsi.jenis === "galat" ? 7000 : 4000),
      },
      // Yang terbaru di paling atas; sisanya dibatasi agar tumpukan tidak
      // menutupi layar saat banyak aksi beruntun.
      ...s.slice(0, 3),
    ]);
  }, []);

  const nilai = useMemo<KonteksToast>(
    () => ({
      tampilkan,
      sukses: (judul, pesan) => tampilkan({ judul, pesan, jenis: "sukses" }),
      galat: (judul, pesan) => tampilkan({ judul, pesan, jenis: "galat" }),
      info: (judul, pesan) => tampilkan({ judul, pesan, jenis: "info" }),
      peringatan: (judul, pesan) => tampilkan({ judul, pesan, jenis: "peringatan" }),
    }),
    [tampilkan],
  );

  return (
    <Konteks.Provider value={nilai}>
      {children}
      {/* Padding atas pada layar kecil menghindari bilah header aplikasi
          yang sticky (h-14) dan baru hilang di breakpoint lg. */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-[4.5rem] pb-4 sm:items-end lg:px-6 lg:pt-6"
        aria-live="polite"
      >
        {daftar.map((t) => (
          <KartuToast key={t.id} toast={t} onTutup={() => tutup(t.id)} />
        ))}
      </div>
    </Konteks.Provider>
  );
}

function KartuToast({ toast, onTutup }: { toast: Toast; onTutup: () => void }) {
  const [masuk, setMasuk] = useState(false);
  const [jeda, setJeda] = useState(false);
  const gaya = GAYA[toast.jenis];
  const Ikon = gaya.ikon;

  // Sisa waktu yang belum berjalan. Disimpan di ref supaya menjeda lalu
  // melanjutkan tidak mengulang hitungan dari awal.
  const sisa = useRef(toast.durasi);
  const mulai = useRef(0);

  useEffect(() => {
    // Satu frame agar transisi masuk benar-benar terlihat.
    const r = requestAnimationFrame(() => setMasuk(true));
    return () => cancelAnimationFrame(r);
  }, []);

  useEffect(() => {
    if (toast.durasi <= 0 || jeda) return;
    mulai.current = Date.now();
    const t = setTimeout(onTutup, sisa.current);
    return () => {
      clearTimeout(t);
      sisa.current = Math.max(0, sisa.current - (Date.now() - mulai.current));
    };
  }, [toast.durasi, jeda, onTutup]);

  return (
    <div
      role={gaya.peran}
      onMouseEnter={() => setJeda(true)}
      onMouseLeave={() => setJeda(false)}
      // Fokus keyboard juga menjeda, supaya pengguna papan ketik punya waktu
      // membaca sebelum notifikasi menghilang.
      onFocusCapture={() => setJeda(true)}
      onBlurCapture={() => setJeda(false)}
      className={cn(
        "pointer-events-auto relative flex w-full max-w-sm items-center gap-3 overflow-hidden rounded-xl border border-l-4 border-slate-200 bg-white p-3.5 shadow-lg",
        "dark:border-slate-700 dark:bg-slate-900",
        "transition-all duration-200",
        gaya.garis,
        masuk ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
      )}
    >
      <Ikon className={cn("h-4.5 w-4.5 shrink-0", gaya.warnaIkon)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{toast.judul}</p>
        {toast.pesan ? <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{toast.pesan}</p> : null}
      </div>
      <div aria-hidden className="h-8 w-px shrink-0 self-stretch bg-slate-200 dark:bg-slate-700" />
      <button
        type="button"
        onClick={onTutup}
        className={cn(
          "-mr-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400",
          "transition-all duration-300 ease-out hover:rotate-180",
          gaya.hoverTutup,
        )}
        aria-label="Tutup notifikasi"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {toast.durasi > 0 ? (
        <div
          data-uji="bilah-toast"
          aria-hidden
          className={cn("absolute inset-x-0 bottom-0 h-0.5 origin-left", gaya.bilah)}
          style={{
            animation: `toast-susut ${toast.durasi}ms linear forwards`,
            animationPlayState: jeda ? "paused" : "running",
          }}
        />
      ) : null}
    </div>
  );
}
