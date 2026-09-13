"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { AlertTriangle, HelpCircle, LogOut, Trash2 } from "lucide-react";

import { Pemuat, Tombol } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type NadaKonfirmasi = "bahaya" | "peringatan" | "biasa";

export interface OpsiKonfirmasi {
  judul: string;
  pesan?: string;
  /** Teks tombol pengiya. Default "Lanjutkan". */
  tombolYa?: string;
  tombolTidak?: string;
  nada?: NadaKonfirmasi;
  /** Ditampilkan sebagai catatan kecil, mis. konsekuensi yang tak bisa dibatalkan. */
  catatan?: string;
}

const IKON: Record<NadaKonfirmasi, typeof AlertTriangle> = {
  bahaya: Trash2,
  peringatan: AlertTriangle,
  biasa: HelpCircle,
};

const NADA: Record<NadaKonfirmasi, { bulat: string; ikon: string }> = {
  bahaya: { bulat: "bg-rose-50", ikon: "text-rose-600" },
  peringatan: { bulat: "bg-amber-50", ikon: "text-amber-600" },
  biasa: { bulat: "bg-brand-50", ikon: "text-brand-600" },
};

type Konteks = (opsi: OpsiKonfirmasi) => Promise<boolean>;

const KonteksKonfirmasi = createContext<Konteks | null>(null);

/**
 * Meminta persetujuan sebelum aksi yang sulit dibatalkan.
 *
 * ```ts
 * if (await konfirmasi({ judul: "Hapus penilaian?", nada: "bahaya" })) { … }
 * ```
 */
export function useKonfirmasi(): Konteks {
  const k = useContext(KonteksKonfirmasi);
  if (!k) throw new Error("useKonfirmasi harus dipakai di dalam <PenyediaKonfirmasi>.");
  return k;
}

export function PenyediaKonfirmasi({ children }: { children: React.ReactNode }) {
  const [opsi, setOpsi] = useState<OpsiKonfirmasi | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const jawab = useRef<((setuju: boolean) => void) | null>(null);

  const konfirmasi = useCallback<Konteks>((o) => {
    setOpsi(o);
    setSibuk(false);
    return new Promise<boolean>((resolve) => {
      jawab.current = resolve;
    });
  }, []);

  const selesai = useCallback((setuju: boolean) => {
    jawab.current?.(setuju);
    jawab.current = null;
    setOpsi(null);
  }, []);

  const nilai = useMemo(() => konfirmasi, [konfirmasi]);
  const nada = opsi?.nada ?? "biasa";
  const Ikon = opsi?.tombolYa?.toLowerCase().includes("keluar") ? LogOut : IKON[nada];

  return (
    <KonteksKonfirmasi.Provider value={nilai}>
      {children}

      <Dialog
        buka={opsi !== null}
        onTutup={() => selesai(false)}
        judul={opsi?.judul ?? ""}
        lebar="max-w-md"
      >
        <div className="flex gap-4">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              NADA[nada].bulat,
            )}
          >
            <Ikon className={cn("h-5 w-5", NADA[nada].ikon)} aria-hidden />
          </div>

          <div className="min-w-0 flex-1">
            {opsi?.pesan ? <p className="text-sm text-slate-600">{opsi.pesan}</p> : null}
            {opsi?.catatan ? (
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                {opsi.catatan}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <Tombol varian="garis" onClick={() => selesai(false)} disabled={sibuk}>
                {opsi?.tombolTidak ?? "Batal"}
              </Tombol>
              <Tombol
                varian={nada === "bahaya" ? "bahaya" : nada === "peringatan" ? "peringatan" : "utama"}
                onClick={() => {
                  setSibuk(true);
                  selesai(true);
                }}
                disabled={sibuk}
              >
                {sibuk ? <Pemuat /> : null}
                {opsi?.tombolYa ?? "Lanjutkan"}
              </Tombol>
            </div>
          </div>
        </div>
      </Dialog>
    </KonteksKonfirmasi.Provider>
  );
}
