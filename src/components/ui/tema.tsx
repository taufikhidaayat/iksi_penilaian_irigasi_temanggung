"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";

import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

export type Tema = "terang" | "gelap" | "sistem";

const KUNCI = "siksi-tema";
const MEDIA = "(prefers-color-scheme: dark)";

/**
 * Skrip yang dijalankan sebelum halaman digambar, untuk mencegah kedipan tema
 * terang saat pengguna sebenarnya memilih gelap. Disisipkan di <head> layout.
 *
 * Sengaja ditulis sebagai string kecil tanpa dependensi: apa pun yang berjalan
 * di sini menahan render pertama.
 */
export const SKRIP_TEMA = `(function(){try{
var t=localStorage.getItem('${KUNCI}')||'terang';
var g=t==='gelap'||(t==='sistem'&&matchMedia('${MEDIA}').matches);
document.documentElement.classList.toggle('gelap',g);
document.documentElement.style.colorScheme=g?'dark':'light';
}catch(e){}})();`;

/* ------------------------------------------------------------------ */
/* Sumber data eksternal                                               */
/*                                                                     */
/* Tema tersimpan di localStorage dan setelan sistem di matchMedia —    */
/* keduanya di luar React. Dibaca lewat useSyncExternalStore, bukan     */
/* useEffect + setState, supaya nilai saat hidrasi konsisten dan tidak  */
/* ada render tambahan yang tidak perlu.                               */
/* ------------------------------------------------------------------ */

const pendengar = new Set<() => void>();

function beritahu() {
  for (const cb of pendengar) cb();
}

function langgananTema(cb: () => void) {
  pendengar.add(cb);
  // `storage` menjaga tab lain ikut berubah saat tema diganti di satu tab.
  window.addEventListener("storage", cb);
  return () => {
    pendengar.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function bacaTema(): Tema {
  const t = localStorage.getItem(KUNCI);
  return t === "terang" || t === "gelap" || t === "sistem" ? t : "terang";
}

function langgananSistem(cb: () => void) {
  const mq = window.matchMedia(MEDIA);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

const bacaSistemGelap = () => window.matchMedia(MEDIA).matches;

/* ------------------------------------------------------------------ */

interface KonteksTema {
  tema: Tema;
  /** Tema yang benar-benar tampil setelah "sistem" diterjemahkan. */
  aktif: "terang" | "gelap";
  setTema: (t: Tema) => void;
}

const Konteks = createContext<KonteksTema | null>(null);

export function useTema(): KonteksTema {
  const k = useContext(Konteks);
  if (!k) throw new Error("useTema harus dipakai di dalam <PenyediaTema>.");
  return k;
}

export function PenyediaTema({ children }: { children: React.ReactNode }) {
  // Snapshot server "sistem"/terang menyamai keadaan awal HTML, sehingga
  // hidrasi tidak berbenturan; nilai sebenarnya dibaca tepat setelahnya.
  const tema = useSyncExternalStore(langgananTema, bacaTema, () => "terang" as Tema);
  const sistemGelap = useSyncExternalStore(langgananSistem, bacaSistemGelap, () => false);

  const aktif: "terang" | "gelap" =
    tema === "sistem" ? (sistemGelap ? "gelap" : "terang") : tema;

  // Menyelaraskan kelas pada <html>. Ini efek samping DOM murni, bukan
  // penyetelan state, jadi memang tempatnya di dalam useEffect.
  useEffect(() => {
    const html = document.documentElement;
    const gelap = aktif === "gelap";
    if (html.classList.contains("gelap") === gelap) return;

    html.classList.add("transisi-tema");
    html.classList.toggle("gelap", gelap);
    html.style.colorScheme = gelap ? "dark" : "light";
    const t = window.setTimeout(() => html.classList.remove("transisi-tema"), 250);
    return () => window.clearTimeout(t);
  }, [aktif]);

  const setTema = useCallback((t: Tema) => {
    localStorage.setItem(KUNCI, t);
    beritahu();
  }, []);

  return <Konteks.Provider value={{ tema, aktif, setTema }}>{children}</Konteks.Provider>;
}

/* ------------------------------------------------------------------ */

const PILIHAN: { nilai: Tema; label: string; ikon: typeof Sun }[] = [
  { nilai: "terang", label: "Terang", ikon: Sun },
  { nilai: "gelap", label: "Gelap", ikon: Moon },
  { nilai: "sistem", label: "Ikuti sistem", ikon: Monitor },
];

/** Tombol tiga posisi: Terang · Gelap · Ikuti sistem. */
export function SaklarTema({ className }: { className?: string }) {
  const { tema, setTema } = useTema();

  return (
    <div
      role="radiogroup"
      aria-label="Tema tampilan"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 p-1 backdrop-blur",
        "dark:border-white/10 dark:bg-white/5",
        className,
      )}
    >
      {PILIHAN.map(({ nilai, label, ikon: Ikon }) => {
        const dipilih = tema === nilai;
        return (
          <button
            key={nilai}
            type="button"
            role="radio"
            aria-checked={dipilih}
            title={label}
            onClick={() => setTema(nilai)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
              dipilih
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10",
            )}
          >
            <Ikon className="h-4 w-4" aria-hidden />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
