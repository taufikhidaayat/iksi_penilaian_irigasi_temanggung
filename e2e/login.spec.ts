import { expect, test } from "@playwright/test";

/**
 * Uji alur login lewat browser sungguhan.
 *
 * Dibuat setelah login gagal padahal semua uji lain hijau. Penyebabnya ganda:
 * (1) server dev lama masih memegang port 3000 sehingga melayani kode basi, dan
 * (2) tidak ada satu pun uji yang menekan tombol Masuk — `uji-halaman.mjs`
 * menyusun cookie sesi sendiri lewat supabase-js, jadi Server Action `masuk()`
 * tidak pernah dilewati.
 *
 * Meniru encoding Server Action dengan fetch terbukti rapuh (formatnya internal
 * dan berubah antar versi Next), jadi jalur ini diuji dengan browser asli.
 */

/**
 * Locator memakai id, bukan label: tombol mata pada field sandi ber-aria-label
 * "Tampilkan kata sandi" sehingga getByLabel("Kata Sandi") cocok ke dua elemen.
 */
const isiLogin = async (page: import("@playwright/test").Page, u: string, s: string) => {
  await page.locator("#username").fill(u);
  await page.locator("#sandi").fill(s);
  await page.getByRole("button", { name: /^Masuk$/ }).click();
};

/**
 * Kotak galat di dalam form. Dibatasi ke dalam <form> karena Next memasang
 * route announcer-nya sendiri dengan role="alert" di tingkat dokumen.
 */
const galatForm = (page: import("@playwright/test").Page) => page.locator('form [role="alert"]');

const AKUN = {
  admin: { username: "admin", sandi: "IksiAdmin#2026" },
  upt: { username: "upt.ngadirejo", sandi: "UptIksi#2026" },
};

test.describe("form login", () => {
  test("menampilkan field Username, bukan Alamat Email", async ({ page }) => {
    await page.goto("/masuk");
    await expect(page.locator("#username")).toBeVisible();
    await expect(page.locator("#sandi")).toBeVisible();
    await expect(page.getByText("Alamat Email")).toHaveCount(0);
    await expect(page.getByText("Username", { exact: true })).toBeVisible();
  });

  test("Administrator bisa masuk dan melihat seluruh UPT", async ({ page }) => {
    await page.goto("/masuk");
    await isiLogin(page, AKUN.admin.username, AKUN.admin.sandi);

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: /Selamat datang/ })).toBeVisible();
    await expect(page.getByText("Semua UPT")).toBeVisible();
    // Menu khusus admin.
    await expect(page.getByRole("link", { name: "Pengguna" })).toBeVisible();
  });

  test("Petugas UPT bisa masuk dan hanya melihat UPT-nya", async ({ page }) => {
    await page.goto("/masuk");
    await isiLogin(page, AKUN.upt.username, AKUN.upt.sandi);

    await expect(page).toHaveURL("/");
    await expect(page.getByText("Regional III - Ngadirejo").first()).toBeVisible();
    // Menu Pengguna hanya untuk admin.
    await expect(page.getByRole("link", { name: "Pengguna" })).toHaveCount(0);
  });

  test("username tidak peka huruf besar/kecil dan spasi", async ({ page }) => {
    await page.goto("/masuk");
    await isiLogin(page, "  UPT.NGADIREJO  ", AKUN.upt.sandi);

    await expect(page).toHaveURL("/");
  });

  test("kata sandi salah ditolak dengan pesan", async ({ page }) => {
    await page.goto("/masuk");
    await isiLogin(page, AKUN.admin.username, "SandiSalah#1");

    await expect(galatForm(page)).toContainText("Username atau kata sandi salah");
    await expect(page).toHaveURL(/\/masuk/);
  });

  test("username tak terdaftar memberi pesan yang sama persis", async ({ page }) => {
    // Pesan tidak boleh membedakan keduanya, supaya daftar username tidak bisa
    // ditebak dari luar.
    await page.goto("/masuk");
    await isiLogin(page, "tidakadaakun", "SandiSalah#1");

    await expect(galatForm(page)).toContainText("Username atau kata sandi salah");
  });

  test("rute terlindungi mengembalikan ke /masuk lalu melanjutkan ke tujuan", async ({ page }) => {
    await page.goto("/rekap");
    await expect(page).toHaveURL(/\/masuk\?lanjut=%2Frekap/);

    await isiLogin(page, AKUN.admin.username, AKUN.admin.sandi);

    await expect(page).toHaveURL("/rekap");
    await expect(page.getByRole("heading", { name: "Rekapitulasi" })).toBeVisible();
  });

  test("keluar mengakhiri sesi (lewat dialog konfirmasi)", async ({ page }) => {
    await page.goto("/masuk");
    await isiLogin(page, AKUN.admin.username, AKUN.admin.sandi);
    await expect(page).toHaveURL("/");

    await page.getByRole("button", { name: "Keluar" }).click();
    await page.locator("dialog[open]").getByRole("button", { name: "Ya, keluar" }).click();
    await expect(page).toHaveURL(/\/masuk/);

    // Sesi benar-benar hilang, bukan sekadar dialihkan.
    await page.goto("/rekap");
    await expect(page).toHaveURL(/\/masuk/);
  });
});
