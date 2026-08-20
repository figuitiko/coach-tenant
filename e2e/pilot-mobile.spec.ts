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

test("authenticated mobile roles can navigate, log training, and submit progress", async ({ browser }) => {
  test.skip(!enabled, "TEST_DATABASE_URL is mandatory for authenticated mobile E2E");
  const coachContext = await browser.newContext();
  const coach = await coachContext.newPage();
  await signIn(coach, "pilot.coach@tenand.local");
  await coach.goto("/w/fuerza-norte-pilot");
  const coachNavigation = coach.getByRole("navigation", { name: /navegación móvil/i });
  await expect(coachNavigation.getByRole("link", { name: "Alumnos" })).toBeVisible();
  await expect(coachNavigation.getByRole("link", { name: "Revisiones" })).toBeVisible();
  await coachContext.close();

  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  await signIn(student, "pilot.student1@tenand.local");
  await student.goto("/w/fuerza-norte-pilot");
  const studentNavigation = student.getByRole("navigation", { name: /navegación móvil/i });
  await expect(studentNavigation.getByRole("link", { name: "Entrenamiento" })).toBeVisible();
  await expect(studentNavigation.getByRole("link", { name: "Progreso" })).toBeVisible();
  await student.goto("/w/fuerza-norte-pilot/training?date=2026-08-21");
  const setForm = student.getByRole("form", { name: /registrar serie 2 de press banca/i });
  await setForm.getByLabel(/repeticiones reales/i).fill("8");
  await setForm.getByLabel(/peso real/i).fill("42.5");
  await setForm.getByLabel(/serie completada/i).check();
  await setForm.getByRole("button", { name: /guardar serie/i }).click();
  await expect(setForm.getByRole("status")).toContainText(/guardad/i);
  await student.goto("/w/fuerza-norte-pilot/progress");
  await student.getByLabel(/^peso$/i).fill("68.1");
  await student.getByRole("button", { name: /guardar borrador/i }).click();
  await expect(student.getByRole("status").filter({ hasText: /guardad/i }).first()).toBeVisible();
  await student.getByRole("button", { name: /enviar check-in/i }).click();
  await expect(student.getByText(/check-in enviado/i).first()).toBeVisible();
  await studentContext.close();
});
