import type { PeriodeTriwulan } from "@/lib/supabase/types";

export const TRIWULAN: readonly PeriodeTriwulan[] = [
  "Triwulan I",
  "Triwulan II",
  "Triwulan III",
  "Triwulan IV",
];

/** Triwulan berjalan berdasarkan bulan. */
export function triwulanBerjalan(d = new Date()): PeriodeTriwulan {
  return TRIWULAN[Math.floor(d.getMonth() / 3)];
}

export function tahunBerjalan(d = new Date()): number {
  return d.getFullYear();
}

/** Daftar tahun untuk penyaring: 5 tahun ke belakang + 1 ke depan. */
export function daftarTahun(sekarang = tahunBerjalan()): number[] {
  return Array.from({ length: 7 }, (_, i) => sekarang + 1 - i);
}

export interface Periode {
  tahun: number;
  triwulan: PeriodeTriwulan;
}

/** Triwulan tepat sebelum periode ini; Triwulan I mundur ke Triwulan IV tahun lalu. */
export function periodeSebelumnya({ tahun, triwulan }: Periode): Periode {
  const i = TRIWULAN.indexOf(triwulan);
  return i > 0
    ? { tahun, triwulan: TRIWULAN[i - 1] }
    : { tahun: tahun - 1, triwulan: TRIWULAN[TRIWULAN.length - 1] };
}

/** Baca periode dari query string, jatuh ke periode berjalan bila tidak valid. */
export function bacaPeriode(
  sp: Record<string, string | string[] | undefined>,
): Periode {
  const t = Number(Array.isArray(sp.tahun) ? sp.tahun[0] : sp.tahun);
  const tw = Array.isArray(sp.triwulan) ? sp.triwulan[0] : sp.triwulan;
  return {
    tahun: Number.isInteger(t) && t >= 2000 && t <= 2100 ? t : tahunBerjalan(),
    triwulan: TRIWULAN.includes(tw as PeriodeTriwulan)
      ? (tw as PeriodeTriwulan)
      : triwulanBerjalan(),
  };
}
