import { expect, test, type Page } from "@playwright/test";

/**
 * Dialog Aset hanya hidup setelah JavaScript berjalan, jadi hanya browser
 * sungguhan yang bisa membuktikan apa yang benar-benar terbaca petugas.
 */

const ADMIN = { username: "admin", sandi: "IksiAdmin#2026" };

async function masuk(page: Page) {
  await page.goto("/masuk");
  await page.locator("#username").fill(ADMIN.username);
  await page.locator("#sandi").fill(ADMIN.sandi);
  await page.getByRole("button", { name: /^Masuk$/ }).click();
  await expect(page).toHaveURL("/");
}

async function bukaAsetPertama(page: Page, jenis: string) {
  await page.goto(`/aset?jenis=${jenis}`);
  await page.locator('button[aria-label^="Ubah"]').first().click();
  await expect(page.locator("dialog[open]")).toBeVisible();
}

test.describe("dialog Aset", () => {
  test("dropdown Daerah Irigasi menampilkan namanya, bukan id barisnya", async ({ page }) => {
    // `Pilihan` adalah dropdown kustom: select aslinya disembunyikan dan yang
    // terbaca petugas adalah tombol. Dulu isi <option> yang tersusun dari
    // beberapa potong ({nama} ({kode})) jatuh ke NILAI option, sehingga yang
    // tampil "287" — id baris di database — bukan nama D.I.-nya.
    await masuk(page);
    await bukaAsetPertama(page, "tanah_saluran");

    const pilihanDi = page.locator("#a-di");
    await expect(pilihanDi).toContainText("D.I.");
    await expect(pilihanDi).toContainText("3323");
    await expect(pilihanDi).not.toHaveText(/^\d+$/);
  });

  test("nomor aset memuat golongan dan UPT", async ({ page }) => {
    // 33 . 23 . [golongan] . [UPT + nomor D.I.] . [tipe + urut] . [tahun]
    const BERFORMAT_SIKSI = /^33\.23\.0[12]0306\.0[1-6]\d{3}\.\d+\.\d{4}$/;

    await masuk(page);

    await bukaAsetPertama(page, "tanah_saluran");
    await expect(page.locator("#a-kode")).toHaveValue(/^33\.23\.020306\./);
    await expect(page.locator("#a-kode")).toHaveValue(BERFORMAT_SIKSI);
    await expect(page.locator("dialog[open]")).toContainText("Golongan aset tanah");
    await expect(page.locator("dialog[open]")).toContainText("UPT Regional");
    await page.locator("dialog[open]").getByRole("button", { name: "Batal" }).click();

    await bukaAsetPertama(page, "bendung");
    await expect(page.locator("#a-kode")).toHaveValue(/^33\.23\.010306\./);
    await expect(page.locator("#a-kode")).toHaveValue(BERFORMAT_SIKSI);
    await expect(page.locator("dialog[open]")).toContainText("Golongan bangunan irigasi");
    await expect(page.locator("dialog[open]")).toContainText("UPT Regional");
  });
});
