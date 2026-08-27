import { expect, test } from "@playwright/test";

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const password = process.env.PILOT_SEED_PASSWORD;

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(requiredPilotSeedPassword());
  await page.getByRole("button", { name: /ingresar al workspace/i }).click();
  await expect(page).toHaveURL(/\/workspace|\/w\//);
}

test.describe("pilot PostgreSQL journeys", () => {
  test.skip(!enabled, "TEST_DATABASE_URL is mandatory for authenticated pilot E2E");
  test.describe.configure({ mode: "serial" });

  test("super admin selects either workspace through explicit global context", async ({ page }) => {
    await signIn(page, "pilot.admin@tenand.local");
    await expect(page).toHaveURL(/\/workspace$/);
    await expect(page.getByText(/panel de super admin/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /fuerza norte/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /movimiento sur/i })).toBeVisible();
  });

  test("ordinary tenant coaches cannot guess the other workspace", async ({ page }) => {
    await signIn(page, "coach.fuerzanorte@tenand.local");
    await expect(page).toHaveURL(/\/w\/fuerza-norte-pilot$/);
    await page.goto("/w/movimiento-sur-pilot");
    await expectStreamedAccessDenial(page, "Movimiento Sur");

    await page.context().clearCookies();
    await signIn(page, "coach.movimientosur@tenand.local");
    await expect(page).toHaveURL(/\/w\/movimiento-sur-pilot$/);
    await page.goto("/w/fuerza-norte-pilot");
    await expectStreamedAccessDenial(page, "Fuerza Norte");
  });

  test("new user accepts an active invitation exactly once", async ({ page }) => {
    const invitePath = "/invite/pilot-active-invitation-token-0001";
    await page.goto(`/sign-in?callbackURL=${encodeURIComponent(invitePath)}`);
    await expect(page.getByRole("heading", { name: /volvé al trabajo/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /creá tu cuenta/i })).toBeVisible();
    await page.getByLabel("Nombre").fill("Invitada Piloto");
    await page.getByLabel("Email").nth(1).fill("pilot.invited@tenand.local");
    await page.getByLabel("Contraseña").nth(1).fill(requiredPilotSeedPassword());
    await page.getByRole("button", { name: /crear cuenta/i }).click();
    await expect(page).toHaveURL(new RegExp(`${invitePath}$`));
    await page.getByRole("button", { name: /aceptar invitación/i }).click();
    await expect(page).toHaveURL(/\/w\/fuerza-norte-pilot$/);

    await page.context().clearCookies();
    await signIn(page, "coach.fuerzanorte@tenand.local");
    await page.goto(invitePath);
    await page.getByRole("button", { name: /aceptar invitación/i }).click();
    await expect(page).toHaveURL(/\/workspace\?invite=unavailable$/);
  });

  test("coach can author training data and assign a saved plan", async ({ page }) => {
    await signIn(page, "coach.fuerzanorte@tenand.local");
    await page.goto("/w/fuerza-norte-pilot/students");
    await page.getByRole("link", { name: /gestionar entrenamiento de martina lópez/i }).click();
    await expect(page).toHaveURL(/studentMembershipId=pilot-membership-student-1/);
    await expect(page.getByRole("heading", { name: "Entrenamiento" })).toBeVisible();
    await expect(page.getByText(/asignando a martina lópez/i)).toBeVisible();
    for (const step of ["Paso 1", "Paso 2", "Paso 3", "Paso 4"]) {
      await expect(page.getByText(step, { exact: true })).toBeVisible();
    }
    const exercise = page.getByRole("form", { name: /crear ejercicio/i });
    await exercise.getByLabel("Nombre").fill("Zancada piloto E2E");
    await exercise.getByRole("button", { name: /guardar ejercicio/i }).click();
    await expect(exercise.getByRole("status")).toContainText(/guardad/i);
    const template = page.getByRole("form", { name: /crear plantilla/i });
    await template.getByLabel(/nombre de plantilla/i).fill("Plantilla E2E");
    await template.getByRole("combobox", { name: "Ejercicio", exact: true }).first().selectOption({ label: "Zancada piloto E2E" });
    await template.getByLabel("Series").first().fill("3");
    await template.getByLabel(/reps mín/i).first().fill("8");
    await template.getByLabel(/reps máx/i).first().fill("10");
    await template.getByRole("button", { name: /crear plantilla/i }).click();
    await expect(template.getByRole("status")).toContainText(/guardad/i);

    const plan = page.getByRole("form", { name: /programar plan/i });
    await plan.getByLabel(/nombre del bloque/i).fill("Plan E2E");
    await plan.getByLabel("Inicio").fill("2026-08-24");
    await plan.getByLabel("Fin").fill("2026-08-30");
    await plan.getByLabel("Plantilla").first().selectOption({ label: "Plantilla E2E" });
    await plan.getByLabel("Fecha").first().fill("2026-08-24");
    await plan.getByRole("button", { name: /programar plan/i }).click();
    await expect(plan.getByRole("status")).toContainText(/guardad/i);
    const assignment = page.getByRole("form", { name: /asignar plan/i });
    await assignment.getByLabel("Plan").selectOption({ label: "Plan E2E" });
    await expect(assignment.getByLabel("Alumno")).toHaveValue("pilot-membership-student-1");
    await assignment.getByRole("button", { name: /asignar plan/i }).click();
    await expect(assignment.getByRole("status")).toContainText(/guardad/i);

    await page.goto("/w/fuerza-norte-pilot/training?studentMembershipId=pilot-membership-student-1-south");
    await expectStreamedAccessDenial(page, "Martina López");
  });

  test("coach signs out from functional desktop navigation", async ({ page }) => {
    await signIn(page, "coach.fuerzanorte@tenand.local");
    await page.goto("/w/fuerza-norte-pilot/training");
    const navigation = page.getByRole("navigation", { name: "Navegación del workspace" });

    await expect(navigation.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    await navigation.getByRole("button", { name: "Cerrar sesión" }).click();

    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto("/w/fuerza-norte-pilot/training");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("student discovers a dated workout, completes it, and submits current measurements", async ({ page }) => {
    await signIn(page, "pilot.student1@tenand.local");
    await page.goto("/w/fuerza-norte-pilot/training");
    await expect(page.getByRole("heading", { name: /tu plan asignado/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /día anterior/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /día siguiente/i })).toBeVisible();
    await page.getByRole("link", { name: /abrir torso · base/i }).click();
    await expect(page).toHaveURL(/date=2026-08-21/);
    const setForm = page.getByRole("form", { name: /registrar serie 1 de press banca/i });
    await setForm.getByLabel(/repeticiones reales/i).fill("8");
    await setForm.getByLabel(/peso real/i).fill("42.5");
    await setForm.getByLabel(/serie completada/i).check();
    await setForm.getByRole("button", { name: /guardar serie/i }).click();
    await expect(setForm.getByRole("status")).toContainText(/guardad/i);
    await page.getByRole("button", { name: /finalizar entrenamiento/i }).click();
    await expect(page.getByRole("button", { name: /entrenamiento finalizado/i })).toBeDisabled();

    await page.goto("/w/fuerza-norte-pilot/progress");
    await page.getByLabel(/^peso$/i).fill("68.2");
    await page.getByLabel(/notas/i).fill("Valores actuales enviados en un solo paso.");
    await page.getByRole("button", { name: /enviar check-in/i }).click();
    await expect(page.getByText(/check-in enviado/i).first()).toBeVisible();
  });

  test("coach reviews, the owning student replies, and the coach sees the reply", async ({ page }) => {
    const coachNote = "Buen trabajo. Mantenemos la progresión E2E.";
    const studentReply = "Entendido, mantengo la carga esta semana.";
    await signIn(page, "coach.fuerzanorte@tenand.local");
    await page.goto("/w/fuerza-norte-pilot/progress");
    const review = page.getByRole("link", { name: /revisar check-in de martina lópez/i }).first();
    await review.click();
    await page.getByLabel(/nota contextual/i).fill(coachNote);
    await page.getByRole("button", { name: /marcar revisado/i }).click();
    await expect(page.getByRole("status")).toContainText(/guardad/i);

    await page.context().clearCookies();
    await signIn(page, "pilot.student1@tenand.local");
    await page.goto("/w/fuerza-norte-pilot/progress");
    await expect(page.getByText(coachNote)).toBeVisible();
    const response = page.getByRole("form", { name: /responder a la devolución/i });
    await expect(response).toBeVisible();
    await response.getByLabel(/respuesta breve/i).fill(studentReply);
    await response.getByRole("button", { name: /enviar respuesta/i }).click();
    await expect(page.getByText(`Tu respuesta: ${studentReply}`)).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, "coach.fuerzanorte@tenand.local");
    await page.goto("/w/fuerza-norte-pilot/progress");
    const replied = page.getByRole("region", { name: /respuestas de alumnos/i });
    await expect(replied).toContainText(studentReply);
    await replied.getByRole("link", { name: /ver respuesta de martina lópez/i }).first().click();
    await expect(page.getByText(coachNote)).toBeVisible();
    await expect(page.getByText(`Respuesta del alumno: ${studentReply}`)).toBeVisible();
  });
});

function requiredPilotSeedPassword() {
  if (!password) throw new Error("PILOT_SEED_PASSWORD is required for authenticated pilot E2E.");
  return password;
}

async function expectStreamedAccessDenial(page: import("@playwright/test").Page, forbiddenContent: string) {
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await expect(page.getByText(forbiddenContent, { exact: false })).toHaveCount(0);
  await expect(page.getByText("Panel del coach", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Tu equipo, en contexto." })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: /navegación/i })).toHaveCount(0);
  await expect(page.getByLabel("Perfil")).toHaveCount(0);
}
