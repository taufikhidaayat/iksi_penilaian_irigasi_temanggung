import type { JenisToast } from "@/components/ui/toast";

/**
 * Notifikasi kilat yang harus selamat melewati `redirect()`.
 *
 * Server Action seperti masuk/keluar mengakhiri dirinya dengan redirect,
 * sehingga state React — termasuk antrean toast — ikut hilang. Pesannya
 * karena itu dititipkan lewat query string, lalu dibaca dan ditampilkan di
 * halaman tujuan.
 *
 * Yang dititipkan hanyalah KUNCI, bukan teksnya. Isi pesan diambil dari tabel
 * di bawah, jadi query string yang diutak-atik tidak bisa memunculkan tulisan
 * sembarangan di aplikasi.
 */

export const PARAM_NOTIF = "notif";

export type KunciNotif = "masuk" | "keluar" | "sesi-habis";

export const PESAN_NOTIF: Record<
  KunciNotif,
  { jenis: JenisToast; judul: string; pesan?: string }
> = {
  masuk: {
    jenis: "sukses",
    judul: "Berhasil masuk",
    pesan: "Selamat datang kembali di SIKSI.",
  },
  keluar: {
    jenis: "info",
    judul: "Berhasil keluar",
    pesan: "Sesi Anda sudah diakhiri. Sampai jumpa.",
  },
  "sesi-habis": {
    jenis: "peringatan",
    judul: "Sesi berakhir",
    pesan: "Silakan masuk kembali untuk melanjutkan.",
  },
};

export function notifValid(v: string | null | undefined): v is KunciNotif {
  return typeof v === "string" && v in PESAN_NOTIF;
}

/** Menempelkan parameter notifikasi pada sebuah path internal. */
export function denganNotif(path: string, kunci: KunciNotif): string {
  const [jalur, kueri] = path.split("?");
  const params = new URLSearchParams(kueri);
  params.set(PARAM_NOTIF, kunci);
  return `${jalur}?${params}`;
}
