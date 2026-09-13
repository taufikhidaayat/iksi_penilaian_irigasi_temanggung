import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Angka gaya Indonesia: 1.234,56 */
export function formatAngka(nilai: number | null | undefined, desimal = 2): string {
  if (nilai === null || nilai === undefined || Number.isNaN(nilai)) return "–";
  return nilai.toLocaleString("id-ID", {
    minimumFractionDigits: desimal,
    maximumFractionDigits: desimal,
  });
}

export function formatPersen(nilai: number | null | undefined, desimal = 2): string {
  if (nilai === null || nilai === undefined || Number.isNaN(nilai)) return "–";
  return `${formatAngka(nilai, desimal)}%`;
}

export function formatTanggal(iso: string | null | undefined): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
