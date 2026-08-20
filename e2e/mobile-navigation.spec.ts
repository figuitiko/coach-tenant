import { expect, test } from "@playwright/test";

test("mobile public navigation keeps the main action reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /entrar al workspace/i })).toBeVisible();
  await page.getByRole("link", { name: /entrar al workspace/i }).click();
  await expect(page.getByRole("heading", { name: /volvé al trabajo/i })).toBeVisible();
});
