/**
 * Definisi menu navigasi.
 *
 * Sengaja TIDAK mengimpor komponen ikon di sini. Berkas ini dipakai Server
 * Component untuk menyusun menu, lalu hasilnya dikirim ke Shell (client) —
 * dan hanya objek biasa yang boleh melewati batas itu. Komponen React (termasuk
 * ikon lucide, yang berupa objek forwardRef) akan gagal diserialisasi.
 * Karena itu `ikon` di sini hanyalah kunci string; pemetaannya ke komponen
 * dilakukan di dalam Shell.
 */

export type KunciIkon =
  | "dasbor"
  | "penilaian"
  | "rekap"
  | "ekspor"
  | "daerahIrigasi"
  | "aset"
  | "asetDraf"
  | "pengguna";

export interface ItemNav {
  href: string;
  label: string;
  ikon: KunciIkon;
  /** Hanya tampil untuk admin. */
  adminSaja?: boolean;
  /** Cocokkan juga sub-rute di bawahnya. */
  prefix?: boolean;
}

export const MENU: ItemNav[] = [
  { href: "/", label: "Dasbor", ikon: "dasbor" },
  { href: "/penilaian", label: "Penilaian", ikon: "penilaian", prefix: true },
  { href: "/rekap", label: "Rekapitulasi", ikon: "rekap" },
  { href: "/ekspor", label: "Ekspor Excel", ikon: "ekspor" },
  { href: "/daerah-irigasi", label: "Daerah Irigasi", ikon: "daerahIrigasi" },
  { href: "/aset", label: "Aset Irigasi", ikon: "aset" },
  { href: "/aset-draf", label: "Data Aset Draf IKSI", ikon: "asetDraf", adminSaja: true, prefix: true },
  { href: "/pengguna", label: "Pengguna", ikon: "pengguna", adminSaja: true },
];

export function menuUntuk(isAdmin: boolean): ItemNav[] {
  return MENU.filter((m) => !m.adminSaja || isAdmin);
}

export function aktif(pathname: string, item: ItemNav): boolean {
  if (item.href === "/") return pathname === "/";
  return item.prefix ? pathname.startsWith(item.href) : pathname === item.href;
}
