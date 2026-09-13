import { expect, test, type Page } from "@playwright/test";

/**
 * Toast dan dialog konfirmasi hanya ada setelah JavaScript berjalan, jadi
 * keduanya hanya bisa dibuktikan lewat browser sungguhan.
 */

const ADMIN = { username: "admin", sandi: "IksiAdmin#2026" };

async function masuk(page: Page, username: string, sandi: string) {
  await page.goto("/masuk");
  await page.locator("#username").fill(username);
  await page.locator("#sandi").fill(sandi);
  await page.getByRole("button", { name: /^Masuk$/ }).click();
  await expect(page).toHaveURL("/");
}

test.describe("dialog konfirmasi keluar", () => {
  test("meminta konfirmasi, dan Batal membatalkan keluar", async ({ page }) => {
    await masuk(page, ADMIN.username, ADMIN.sandi);

    await page.getByRole("button", { name: "Keluar" }).click();

    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Keluar dari SIKSI?");
    await expect(dialog).toContainText("Perubahan penilaian yang belum tersimpan akan hilang");

    await dialog.getByRole("button", { name: "Batal" }).click();
    await expect(dialog).toBeHidden();

    // Masih di dalam aplikasi, sesi utuh.
    await expect(page).toHaveURL("/");
    await page.reload();
    await expect(page).toHaveURL("/");
  });

  test("menekan Ya, keluar benar-benar mengakhiri sesi", async ({ page }) => {
    await masuk(page, ADMIN.username, ADMIN.sandi);

    await page.getByRole("button", { name: "Keluar" }).click();
    await page.locator("dialog[open]").getByRole("button", { name: "Ya, keluar" }).click();

    await expect(page).toHaveURL(/\/masuk/);
    await page.goto("/rekap");
    await expect(page).toHaveURL(/\/masuk/);
  });

  test("tombol Esc menutup dialog tanpa mengeksekusi aksi", async ({ page }) => {
    await masuk(page, ADMIN.username, ADMIN.sandi);

    await page.getByRole("button", { name: "Keluar" }).click();
    await expect(page.locator("dialog[open]")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toBeHidden();
    await expect(page).toHaveURL("/");
  });
});

test.describe("notifikasi masuk & keluar", () => {
  test("toast sambutan muncul setelah berhasil masuk", async ({ page }) => {
    await masuk(page, ADMIN.username, ADMIN.sandi);

    const toast = page.getByRole("status").filter({ hasText: "Berhasil masuk" });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("Selamat datang kembali");

    // Parameter notifikasi dibersihkan supaya tidak muncul lagi saat reload.
    await expect(page).toHaveURL("/");
    await page.reload();
    await expect(page.getByRole("status").filter({ hasText: "Berhasil masuk" })).toHaveCount(0);
  });

  test("toast muncul di halaman Masuk setelah keluar", async ({ page }) => {
    await masuk(page, ADMIN.username, ADMIN.sandi);
    await page.getByRole("button", { name: "Keluar" }).click();
    await page.locator("dialog[open]").getByRole("button", { name: "Ya, keluar" }).click();

    await expect(page).toHaveURL(/\/masuk/);
    const toast = page.getByRole("status").filter({ hasText: "Berhasil keluar" });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("Sesi Anda sudah diakhiri");
  });

  test("masuk ke rute terlindungi tetap membawa toast ke tujuan", async ({ page }) => {
    await page.goto("/rekap");
    await expect(page).toHaveURL(/\/masuk/);
    await page.locator("#username").fill(ADMIN.username);
    await page.locator("#sandi").fill(ADMIN.sandi);
    await page.getByRole("button", { name: /^Masuk$/ }).click();

    await expect(page).toHaveURL("/rekap");
    await expect(page.getByRole("status").filter({ hasText: "Berhasil masuk" })).toBeVisible();
  });

  test("kunci notifikasi ngawur di URL diabaikan", async ({ page }) => {
    await masuk(page, ADMIN.username, ADMIN.sandi);
    await page.goto("/?notif=<script>alert(1)</script>");
    // Tidak ada toast, dan parameternya tidak dirender apa adanya.
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("alert(1)");
  });
});

test.describe("toast", () => {
  test("muncul saat menyiapkan unduhan Excel, lalu hilang sendiri", async ({ page }) => {
    await masuk(page, ADMIN.username, ADMIN.sandi);
    await page.goto("/ekspor");

    // Cegah unduhan sungguhan mengganggu jalannya uji.
    await page.route("**/api/ekspor**", (r) => r.abort());
    await page.getByRole("button", { name: "Unduh Excel" }).click();

    const toast = page.getByRole("status").filter({ hasText: "Menyiapkan berkas Excel" });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("baris D.I.");

    // Hilang sendiri setelah durasinya habis.
    await expect(toast).toBeHidden({ timeout: 10_000 });
  });

  test("bisa ditutup manual lewat tombol silang", async ({ page }) => {
    await masuk(page, ADMIN.username, ADMIN.sandi);
    await page.goto("/ekspor");
    await page.route("**/api/ekspor**", (r) => r.abort());
    await page.getByRole("button", { name: "Unduh Excel" }).click();

    const toast = page.getByRole("status").filter({ hasText: "Menyiapkan berkas Excel" });
    await expect(toast).toBeVisible();
    await toast.getByRole("button", { name: "Tutup notifikasi" }).click();
    await expect(toast).toBeHidden();
  });
});

test.describe("konfirmasi pengelolaan pengguna", () => {
  test("menonaktifkan akun meminta konfirmasi bernada bahaya", async ({ page }) => {
    await masuk(page, ADMIN.username, ADMIN.sandi);
    await page.goto("/pengguna");

    // Baris akun UPT mana pun; akun sendiri sengaja tidak bisa dinonaktifkan.
    const baris = page.locator("tr", { hasText: "upt.tembarak" });
    await baris.getByRole("button", { name: "Nonaktifkan" }).click();

    const dialog = page.locator("dialog[open]");
    await expect(dialog).toContainText("Nonaktifkan akun");
    await expect(dialog).toContainText("tidak akan bisa masuk lagi");

    // Batalkan — jangan sampai uji ini mengunci akun sungguhan.
    await dialog.getByRole("button", { name: "Batal" }).click();
    await expect(dialog).toBeHidden();
    await expect(baris.getByRole("button", { name: "Nonaktifkan" })).toBeVisible();
  });

  test("akun sendiri tidak bisa dinonaktifkan", async ({ page }) => {
    await masuk(page, ADMIN.username, ADMIN.sandi);
    await page.goto("/pengguna");

    const barisSaya = page.locator("tr", { hasText: "(Anda)" });
    await expect(barisSaya.getByRole("button", { name: "Nonaktifkan" })).toBeDisabled();
  });
});
