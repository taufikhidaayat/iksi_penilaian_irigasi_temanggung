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

/**
 * Angka gaya Indonesia dengan pecahan DIPOTONG, bukan dibulatkan.
 *
 * Dipakai untuk panjang saluran dari GIS, yang punya belasan angka di belakang
 * koma: 48,987652 ditampilkan "48,98", bukan "48,99".
 *
 * Pembulatan sengaja dihindari. Angka ini dibaca petugas sambil mencocokkan
 * ruas saluran di lapangan, dan pembulatan ke atas membuat nilai yang tampil
 * lebih besar daripada yang tercatat. Memotong selalu menghasilkan angka yang
 * benar-benar ada pada datanya.
 *
 * Perhitungannya dilakukan atas bilangan bulat, bukan lewat `toFixed`, karena
 * `toFixed` membulatkan dan hasilnya pun bisa meleset pada pecahan biner
 * tertentu.
 */
export function formatAngkaPotong(nilai: number | null | undefined, desimal = 2): string {
  if (nilai === null || nilai === undefined || !Number.isFinite(nilai)) return "–";

  const faktor = 10 ** desimal;
  // Math.trunc memotong ke arah nol, jadi tandanya ikut terjaga untuk nilai
  // negatif, meski panjang saluran tidak pernah negatif.
  const potong = Math.trunc(nilai * faktor);
  const bulat = Math.trunc(potong / faktor);
  const sisa = Math.abs(potong - bulat * faktor);

  if (desimal <= 0) return bulat.toLocaleString("id-ID");
  return `${bulat.toLocaleString("id-ID")},${String(sisa).padStart(desimal, "0")}`;
}

/** Panjang saluran untuk ditampilkan, mis. "408,75 m". Null jadi tanda pisah. */
export function formatPanjang(meter: number | null | undefined): string {
  if (meter === null || meter === undefined) return "–";
  return `${formatAngkaPotong(meter, 2)} m`;
}
