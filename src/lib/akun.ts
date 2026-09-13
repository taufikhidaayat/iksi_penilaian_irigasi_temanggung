/**
 * Pemetaan username ↔ email akun.
 *
 * Supabase Auth mewajibkan email untuk autentikasi kata sandi, tetapi petugas
 * di lapangan tidak punya (dan tidak perlu) alamat email. Karena itu email
 * diperlakukan sebagai identitas internal yang diturunkan dari username secara
 * deterministik — tidak ada tabel pencarian, dan tidak ada endpoint yang bisa
 * dipakai menebak-nebak username mana yang terdaftar.
 *
 * Konsekuensinya: tidak ada alur "lupa kata sandi" lewat email. Pengaturan
 * ulang sandi dilakukan Administrator dari menu Pengguna — memang begitu
 * prosedur yang diinginkan.
 */

/** Domain email internal. Mengubah ini memutus SELURUH akun yang sudah ada. */
export const DOMAIN_AKUN = "temanggungkab.go.id";

/**
 * Aturan username: huruf kecil, angka, titik, garis bawah, strip.
 * Diawali huruf/angka, panjang 3–32. Sama persis dengan constraint
 * `profil_username_format` di database.
 */
export const POLA_USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalkanUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function usernameValid(input: string): boolean {
  return POLA_USERNAME.test(normalkanUsername(input));
}

/** `ngadirejo` → `ngadirejo@temanggungkab.go.id` */
export function emailDariUsername(username: string): string {
  return `${normalkanUsername(username)}@${DOMAIN_AKUN}`;
}

/** `ngadirejo@temanggungkab.go.id` → `ngadirejo` */
export function usernameDariEmail(email: string): string {
  return email.split("@")[0]?.toLowerCase() ?? email;
}

export const PESAN_USERNAME =
  "Username hanya boleh huruf kecil, angka, titik, garis bawah, dan strip. Panjang 3–32 karakter.";
