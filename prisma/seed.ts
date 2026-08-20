import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
  throw new Error("Pilot seed is disabled in production. Set ALLOW_PRODUCTION_SEED=true only for an intentional reset.");
}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed the pilot workspace.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const password = process.env.PILOT_SEED_PASSWORD ?? "TenandPilot!2026";
const fixedDate = new Date("2026-08-19T15:00:00.000Z");
const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);
const coach = { id: "pilot-coach", name: "Franco Rivera", email: "pilot.coach@tenand.local" };
const students = [
  { id: "pilot-student-1", name: "Martina López", email: "pilot.student1@tenand.local" },
  { id: "pilot-student-2", name: "Facundo Torres", email: "pilot.student2@tenand.local" },
  { id: "pilot-student-3", name: "Nadia Acosta", email: "pilot.student3@tenand.local" },
  { id: "pilot-student-4", name: "Bruno Díaz", email: "pilot.student4@tenand.local" },
  { id: "pilot-student-5", name: "Sofía Ramos", email: "pilot.student5@tenand.local" },
];

async function main() {
  const passwordHash = await hashPassword(password);
  await prisma.workspace.deleteMany({ where: { slug: { in: ["fuerza-norte-pilot", "movimiento-sur-pilot"] } } });
  await prisma.account.deleteMany({ where: { userId: { in: [coach.id, ...students.map(({ id }) => id)] } } });
  await prisma.user.deleteMany({ where: { id: { in: [coach.id, ...students.map(({ id }) => id)] } } });

  for (const user of [coach, ...students]) {
    await prisma.user.create({ data: { ...user, emailVerified: true, createdAt: fixedDate, updatedAt: fixedDate } });
    await prisma.account.create({ data: { id: `pilot-account-${user.id}`, accountId: user.id, providerId: "credential", userId: user.id, password: passwordHash, createdAt: fixedDate, updatedAt: fixedDate } });
  }

  const workspace = await prisma.workspace.create({ data: {
    id: "pilot-workspace-north", slug: "fuerza-norte-pilot", name: "Fuerza Norte · Piloto", ownerId: coach.id,
    timeZone: "America/Mexico_City", createdAt: fixedDate, updatedAt: fixedDate,
    memberships: { create: [
      { id: "pilot-membership-coach", userId: coach.id, role: "COACH", createdAt: fixedDate, updatedAt: fixedDate },
      ...students.map((student, index) => ({ id: `pilot-membership-student-${index + 1}`, userId: student.id, role: "STUDENT" as const, createdAt: fixedDate, updatedAt: fixedDate })),
    ] },
  } });
  await prisma.workspace.create({ data: {
    id: "pilot-workspace-south", slug: "movimiento-sur-pilot", name: "Movimiento Sur · Piloto", ownerId: coach.id,
    timeZone: "America/Argentina/Buenos_Aires", createdAt: fixedDate, updatedAt: fixedDate,
    memberships: { create: [
      { id: "pilot-membership-coach-south", userId: coach.id, role: "COACH", createdAt: fixedDate, updatedAt: fixedDate },
      { id: "pilot-membership-student-1-south", userId: students[0].id, role: "STUDENT", createdAt: fixedDate, updatedAt: fixedDate },
    ] },
  } });

  const exerciseRows = [
    ["pilot-exercise-squat", "Sentadilla", "Rodillas acompañan la línea de los pies."],
    ["pilot-exercise-bench", "Press banca", "Pausa breve y apoyo estable."],
    ["pilot-exercise-row", "Remo con mancuerna", "Tronco estable, recorrido completo."],
    ["pilot-exercise-rdl", "Peso muerto rumano", "Cadera atrás y espalda neutra."],
  ] as const;
  for (const [id, name, notes] of exerciseRows) await prisma.exercise.create({ data: { id, workspaceId: workspace.id, createdById: coach.id, name, notes, createdAt: fixedDate, updatedAt: fixedDate } });

  const lower = await prisma.workoutTemplate.create({ data: { id: "pilot-template-lower", workspaceId: workspace.id, createdById: coach.id, name: "Piernas · Base", description: "Fuerza técnica para el piloto", createdAt: fixedDate, updatedAt: fixedDate, exercises: { create: [
    { id: "pilot-template-exercise-squat", exerciseId: "pilot-exercise-squat", order: 0, prescribedSets: 3, repMin: 6, repMax: 8, targetRpe: 7.5, restSeconds: 120 },
    { id: "pilot-template-exercise-rdl", exerciseId: "pilot-exercise-rdl", order: 1, prescribedSets: 3, repMin: 8, repMax: 10, targetRpe: 8, restSeconds: 90 },
  ] } } });
  const upper = await prisma.workoutTemplate.create({ data: { id: "pilot-template-upper", workspaceId: workspace.id, createdById: coach.id, name: "Torso · Base", description: "Empuje y tracción", createdAt: fixedDate, updatedAt: fixedDate, exercises: { create: [
    { id: "pilot-template-exercise-bench", exerciseId: "pilot-exercise-bench", order: 0, prescribedSets: 3, repMin: 6, repMax: 8, targetRpe: 8, restSeconds: 120 },
    { id: "pilot-template-exercise-row", exerciseId: "pilot-exercise-row", order: 1, prescribedSets: 3, repMin: 8, repMax: 12, targetRpe: 7, restSeconds: 75 },
  ] } } });

  const plan = await prisma.workoutPlan.create({ data: { id: "pilot-plan-august", workspaceId: workspace.id, createdById: coach.id, name: "Bloque piloto · Agosto", startsOn: dateOnly("2026-08-17"), endsOn: dateOnly("2026-08-30"), createdAt: fixedDate, updatedAt: fixedDate, workouts: { create: [
    { id: "pilot-plan-workout-1", templateId: lower.id, order: 0, scheduledOn: dateOnly("2026-08-19") },
    { id: "pilot-plan-workout-2", templateId: upper.id, order: 1, scheduledOn: dateOnly("2026-08-21") },
  ] } } });
  const assignment = await prisma.studentPlanAssignment.create({ data: { id: "pilot-assignment-martina", workspaceId: workspace.id, planId: plan.id, studentMembershipId: "pilot-membership-student-1", assignedById: coach.id, assignedAt: fixedDate } });

  const completed = await prisma.assignedWorkout.create({ data: { id: "pilot-assigned-completed", workspaceId: workspace.id, assignmentId: assignment.id, planWorkoutId: "pilot-plan-workout-1", sourceTemplateId: lower.id, studentId: students[0].id, templateName: lower.name, scheduledOn: dateOnly("2026-08-19"), status: "COMPLETED", createdAt: fixedDate, updatedAt: fixedDate, exercises: { create: [
    { id: "pilot-assigned-squat", sourceExerciseId: "pilot-exercise-squat", exerciseName: "Sentadilla", order: 0, prescribedSets: 3, repMin: 6, repMax: 8, targetRpe: 7.5, restSeconds: 120 },
    { id: "pilot-assigned-rdl", sourceExerciseId: "pilot-exercise-rdl", exerciseName: "Peso muerto rumano", order: 1, prescribedSets: 3, repMin: 8, repMax: 10, targetRpe: 8, restSeconds: 90 },
  ] } } });
  const inProgress = await prisma.assignedWorkout.create({ data: { id: "pilot-assigned-in-progress", workspaceId: workspace.id, assignmentId: assignment.id, planWorkoutId: "pilot-plan-workout-2", sourceTemplateId: upper.id, studentId: students[0].id, templateName: upper.name, scheduledOn: dateOnly("2026-08-21"), status: "IN_PROGRESS", createdAt: fixedDate, updatedAt: fixedDate, exercises: { create: [
    { id: "pilot-assigned-bench", sourceExerciseId: "pilot-exercise-bench", exerciseName: "Press banca", order: 0, prescribedSets: 3, repMin: 6, repMax: 8, targetRpe: 8, restSeconds: 120 },
    { id: "pilot-assigned-row", sourceExerciseId: "pilot-exercise-row", exerciseName: "Remo con mancuerna", order: 1, prescribedSets: 3, repMin: 8, repMax: 12, targetRpe: 7, restSeconds: 75 },
  ] } } });
  await prisma.workoutSession.create({ data: { id: "pilot-session-completed", assignedWorkoutId: completed.id, studentId: students[0].id, status: "COMPLETED", reviewStatus: "PENDING", startedAt: new Date("2026-08-19T13:00:00Z"), completedAt: new Date("2026-08-19T14:00:00Z"), updatedAt: fixedDate, exerciseLogs: { create: { id: "pilot-log-squat", assignedExerciseId: "pilot-assigned-squat", notes: "Técnica estable", createdAt: fixedDate, updatedAt: fixedDate, sets: { create: [
    { id: "pilot-set-1", setNumber: 1, reps: 8, weight: 70, unit: "KG", rpe: 7, completed: true, createdAt: fixedDate, updatedAt: fixedDate },
    { id: "pilot-set-2", setNumber: 2, reps: 7, weight: 70, unit: "KG", rpe: 8, completed: true, createdAt: fixedDate, updatedAt: fixedDate },
  ] } } } } });
  await prisma.workoutSession.create({ data: { id: "pilot-session-in-progress", assignedWorkoutId: inProgress.id, studentId: students[0].id, status: "IN_PROGRESS", reviewStatus: "PENDING", startedAt: fixedDate, updatedAt: fixedDate, exerciseLogs: { create: { id: "pilot-log-bench", assignedExerciseId: "pilot-assigned-bench", createdAt: fixedDate, updatedAt: fixedDate, sets: { create: { id: "pilot-set-bench-incomplete", setNumber: 1, reps: 8, weight: 40, unit: "KG", rpe: 7, completed: false, createdAt: fixedDate, updatedAt: fixedDate } } } } } });

  const checkIn = await prisma.measurementCheckIn.create({ data: { id: "pilot-checkin-submitted", workspaceId: workspace.id, studentId: students[0].id, status: "SUBMITTED", reviewStatus: "PENDING", weight: 68.4, weightUnit: "KG", waist: 76.5, waistUnit: "CM", notes: "Buena energía; sueño más regular.", submitIdempotencyKey: "pilot-submit-checkin", submittedAt: fixedDate, createdAt: fixedDate, updatedAt: fixedDate } });
  const intent = await prisma.photoUploadIntent.create({ data: { id: "pilot-photo-intent", workspaceId: workspace.id, studentId: students[0].id, checkInId: checkIn.id, idempotencyKey: "pilot-photo-intent-key", objectKey: `workspaces/${workspace.id}/students/${students[0].id}/pilot-progress.webp`, mimeType: "image/webp", sizeBytes: 128000, checksumSha256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", expiresAt: new Date("2026-08-19T16:00:00Z"), status: "CONSUMED", consumedAt: fixedDate, createdAt: fixedDate, updatedAt: fixedDate } });
  // ProgressPhoto stores only private object metadata; no public URL is seeded.
  await prisma.progressPhoto.create({ data: { id: "pilot-progress-photo", workspaceId: workspace.id, studentId: students[0].id, checkInId: checkIn.id, objectKey: intent.objectKey, mimeType: intent.mimeType, sizeBytes: intent.sizeBytes, checksumSha256: intent.checksumSha256, idempotencyKey: "pilot-progress-photo-key", uploadIntentId: intent.id, createdAt: fixedDate } });

  console.info(`Seeded ${workspace.slug}. Local-only accounts use password from PILOT_SEED_PASSWORD (default: TenandPilot!2026).`);
}

main().finally(() => prisma.$disconnect());
