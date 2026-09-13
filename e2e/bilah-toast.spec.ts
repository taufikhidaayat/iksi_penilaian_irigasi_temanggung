import { expect, test, type Page } from "@playwright/test";

/** Bilah sisa waktu pada toast: menyusut sesuai waktu, dan berhenti saat di-hover. */

const ADMIN = { username: "admin", sandi: "IksiAdmin#2026" };

async function toastEkspor(page: Page) {
  await page.goto("/masuk");
  await page.locator("#username").fill(ADMIN.username);
  await page.locator("#sandi").fill(ADMIN.sandi);
  await page.getByRole("button", { name: /^Masuk$/ }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/ekspor");
  await page.route("**/api/ekspor**", (r) => r.abort());
  await page.getByRole("button", { name: "Unduh Excel" }).click();

  return page.getByRole("status").filter({ hasText: "Menyiapkan berkas Excel" });
}

/** Lebar bilah yang terlihat, hasil transform scaleX. */
async function lebarBilah(page: Page) {
  const kotak = await page.locator('[data-uji="bilah-toast"]').first().boundingBox();
  return kotak?.width ?? 0;
}

test("bilah menyusut seiring waktu", async ({ page }) => {
  const toast = await toastEkspor(page);
  await expect(toast).toBeVisible();

  const awal = await lebarBilah(page);
  expect(awal).toBeGreaterThan(0);

  await page.waitForTimeout(1200);
  const tengah = await lebarBilah(page);

  expect(tengah).toBeLessThan(awal);
  // Masih ada sisa — belum habis sebelum durasinya lewat.
  expect(tengah).toBeGreaterThan(0);
});

test("bilah berhenti dan toast bertahan selama di-hover", async ({ page }) => {
  const toast = await toastEkspor(page);
  await expect(toast).toBeVisible();

  await toast.hover();
  const saatHover = await lebarBilah(page);

  // Ditahan jauh melewati durasi normal (4 detik).
  await page.waitForTimeout(5000);

  await expect(toast).toBeVisible();
  const setelahnya = await lebarBilah(page);
  // Bilah praktis tidak bergerak selama dijeda.
  expect(Math.abs(setelahnya - saatHover)).toBeLessThan(4);
});

test("setelah kursor pergi, hitungan lanjut sampai toast hilang", async ({ page }) => {
  const toast = await toastEkspor(page);
  await toast.hover();
  await page.waitForTimeout(1000);

  await page.mouse.move(0, 0);
  await expect(toast).toBeHidden({ timeout: 10_000 });
});
