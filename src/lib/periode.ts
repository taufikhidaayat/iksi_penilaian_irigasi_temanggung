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

/**
 * Tahun SIKSI mulai dipakai (lihat `IKSI 2026 FINAL.xlsx`). Tidak ada
 * penilaian sebelum ini, jadi daftar tahun tidak pernah mundur lebih jauh —
 * ubah angka ini saja kalau suatu saat sistemnya "dimulai ulang".
 */
const TAHUN_MULAI = 2026;

/** Lebar jendela minimal yang ditawarkan, dihitung dari `TAHUN_MULAI`. */
const JENDELA_TAHUN_MINIMAL = 5;

/**
 * Daftar tahun untuk penyaring, terbaru dulu.
 *
 * Dimulai tetap dari `TAHUN_MULAI` (tidak ada gunanya menawarkan tahun
 * sebelum sistem ini dipakai), dan ujungnya melebar sendiri begitu tahun
 * berjalan + 1 melewati jendela minimal — jadi tidak perlu disentuh lagi
 * tiap tahun baru datang. Tahun lama tidak pernah gugur dari daftar, karena
 * dasbor/rekap/ekspor tetap perlu menoleh ke periode yang sudah lewat.
 */
export function daftarTahun(sekarang = tahunBerjalan()): number[] {
  const akhir = Math.max(TAHUN_MULAI + JENDELA_TAHUN_MINIMAL - 1, sekarang + 1);
  return Array.from({ length: akhir - TAHUN_MULAI + 1 }, (_, i) => akhir - i);
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
