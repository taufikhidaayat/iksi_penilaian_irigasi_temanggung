import { expect, test } from "@playwright/test";

/** Memastikan toast benar-benar berada di pojok KANAN ATAS viewport. */
test("toast muncul di pojok kanan atas", async ({ page }) => {
  await page.goto("/masuk");
  await page.locator("#username").fill("admin");
  await page.locator("#sandi").fill("IksiAdmin#2026");
  await page.getByRole("button", { name: /^Masuk$/ }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/ekspor");
  await page.route("**/api/ekspor**", (r) => r.abort());
  await page.getByRole("button", { name: "Unduh Excel" }).click();

  const toast = page.getByRole("status").filter({ hasText: "Menyiapkan berkas Excel" });
  await expect(toast).toBeVisible();

  const kotak = (await toast.boundingBox())!;
  const layar = page.viewportSize()!;

  // Bagian atas: berada di paruh atas layar.
  expect(kotak.y).toBeLessThan(layar.height / 2);
  // Bagian kanan: tepi kanannya dekat tepi kanan viewport.
  expect(layar.width - (kotak.x + kotak.width)).toBeLessThan(60);
  // Dan memang di separuh kanan, bukan melebar penuh.
  expect(kotak.x).toBeGreaterThan(layar.width / 2);
});
