import { expect, test } from "@playwright/test";

test("public shell offers the sign-in path", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /cada progreso merece dirección/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /entrar al workspace/i })).toHaveAttribute(
    "href",
    "/sign-in",
  );
});
