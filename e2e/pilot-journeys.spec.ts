import { expect, test } from "@playwright/test";

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const password = process.env.PILOT_SEED_PASSWORD ?? "TenandPilot!2026";

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: /ingresar al workspace/i }).click();
  await expect(page).toHaveURL(/\/workspace|\/w\//);
}

test.describe("pilot PostgreSQL journeys", () => {
  test.skip(!enabled, "TEST_DATABASE_URL is mandatory for authenticated pilot E2E");
  test.describe.configure({ mode: "serial" });

  test("public entry keeps an invite-aware sign-up and sign-in path", async ({ page }) => {
    await page.goto("/sign-in?callbackURL=%2Finvite%2Fpilot-invite-token");
    await expect(page.getByRole("heading", { name: /volvé al trabajo/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /creá tu cuenta/i })).toBeVisible();
    await expect(page.getByLabel("Email").first()).toBeVisible();
  });

  test("coach can author training data and assign a saved plan", async ({ page }) => {
    await signIn(page, "pilot.coach@tenand.local");
    await page.goto("/w/fuerza-norte-pilot/training");
    await expect(page.getByRole("heading", { name: "Entrenamiento" })).toBeVisible();
    const exercise = page.getByRole("form", { name: /crear ejercicio/i });
    await exercise.getByLabel("Nombre").fill("Zancada piloto E2E");
    await exercise.getByRole("button", { name: /guardar ejercicio/i }).click();
    await expect(exercise.getByRole("status")).toContainText(/guardad/i);
    await expect(page.getByRole("form", { name: /crear plantilla/i })).toBeVisible();
    await expect(page.getByRole("form", { name: /programar plan/i })).toBeVisible();
    const assignment = page.getByRole("form", { name: /asignar plan/i });
    await assignment.getByLabel("Plan").selectOption({ label: "Bloque piloto · Agosto" });
    await assignment.getByLabel("Alumno").selectOption({ label: "Martina López" });
    await assignment.getByRole("button", { name: /asignar plan/i }).click();
    await expect(assignment.getByRole("status")).toContainText(/guardad/i);
  });

  test("student can log a set and submit a measurement check-in", async ({ page }) => {
    await signIn(page, "pilot.student1@tenand.local");
    await page.goto("/w/fuerza-norte-pilot/training?date=2026-08-21");
    const setForm = page.getByRole("form", { name: /registrar serie 1 de press banca/i });
    await setForm.getByLabel(/repeticiones reales/i).fill("8");
    await setForm.getByLabel(/peso real/i).fill("42.5");
    await setForm.getByLabel(/serie completada/i).check();
    await setForm.getByRole("button", { name: /guardar serie/i }).click();
    await expect(setForm.getByRole("status")).toContainText(/guardad/i);

    await page.goto("/w/fuerza-norte-pilot/progress");
    await page.getByLabel(/^peso$/i).fill("68.2");
    await page.getByRole("button", { name: /guardar borrador/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /guardad/i }).first()).toBeVisible();
    await page.getByRole("button", { name: /enviar check-in/i }).click();
    await expect(page.getByText(/check-in enviado/i).first()).toBeVisible();
  });

  test("coach can open and complete a review", async ({ page }) => {
    await signIn(page, "pilot.coach@tenand.local");
    await page.goto("/w/fuerza-norte-pilot/progress");
    const review = page.getByRole("link", { name: /revisar (entrenamiento|check-in)/i }).first();
    await review.click();
    await page.getByLabel(/nota contextual/i).fill("Buen trabajo. Mantenemos la progresión.");
    await page.getByRole("button", { name: /marcar revisado/i }).click();
    await expect(page.getByRole("status")).toContainText(/guardad/i);
  });
});
