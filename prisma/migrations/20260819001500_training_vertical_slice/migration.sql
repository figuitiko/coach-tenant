-- CreateEnum
CREATE TYPE "WorkoutStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "WeightUnit" AS ENUM ('KG', 'LB');

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateExercise" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "prescribedSets" INTEGER NOT NULL,
    "repMin" INTEGER NOT NULL,
    "repMax" INTEGER NOT NULL,
    "targetRpe" DECIMAL(3,1),
    "restSeconds" INTEGER,
    "notes" TEXT,

    CONSTRAINT "TemplateExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutPlan" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanWorkout" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "scheduledOn" DATE NOT NULL,

    CONSTRAINT "PlanWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPlanAssignment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "studentMembershipId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentPlanAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignedWorkout" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "planWorkoutId" TEXT NOT NULL,
    "sourceTemplateId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "scheduledOn" DATE NOT NULL,
    "status" "WorkoutStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignedWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignedExercise" (
    "id" TEXT NOT NULL,
    "assignedWorkoutId" TEXT NOT NULL,
    "sourceExerciseId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "prescribedSets" INTEGER NOT NULL,
    "repMin" INTEGER NOT NULL,
    "repMax" INTEGER NOT NULL,
    "targetRpe" DECIMAL(3,1),
    "restSeconds" INTEGER,
    "notes" TEXT,

    CONSTRAINT "AssignedExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "assignedWorkoutId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "WorkoutStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "assignedExerciseId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetLog" (
    "id" TEXT NOT NULL,
    "exerciseLogId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "weight" DECIMAL(8,2) NOT NULL,
    "unit" "WeightUnit" NOT NULL,
    "rpe" DECIMAL(3,1),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exercise_workspaceId_createdAt_idx" ON "Exercise"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_workspaceId_name_key" ON "Exercise"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "WorkoutTemplate_workspaceId_createdAt_idx" ON "WorkoutTemplate"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutTemplate_workspaceId_name_key" ON "WorkoutTemplate"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "TemplateExercise_exerciseId_idx" ON "TemplateExercise"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateExercise_templateId_order_key" ON "TemplateExercise"("templateId", "order");

-- CreateIndex
CREATE INDEX "WorkoutPlan_workspaceId_startsOn_idx" ON "WorkoutPlan"("workspaceId", "startsOn");

-- CreateIndex
CREATE INDEX "PlanWorkout_templateId_idx" ON "PlanWorkout"("templateId");

-- CreateIndex
CREATE INDEX "PlanWorkout_scheduledOn_idx" ON "PlanWorkout"("scheduledOn");

-- CreateIndex
CREATE UNIQUE INDEX "PlanWorkout_planId_order_key" ON "PlanWorkout"("planId", "order");

-- CreateIndex
CREATE INDEX "StudentPlanAssignment_workspaceId_assignedAt_idx" ON "StudentPlanAssignment"("workspaceId", "assignedAt");

-- CreateIndex
CREATE INDEX "StudentPlanAssignment_studentMembershipId_assignedAt_idx" ON "StudentPlanAssignment"("studentMembershipId", "assignedAt");

-- CreateIndex
CREATE INDEX "AssignedWorkout_workspaceId_studentId_scheduledOn_idx" ON "AssignedWorkout"("workspaceId", "studentId", "scheduledOn");

-- CreateIndex
CREATE INDEX "AssignedWorkout_assignmentId_idx" ON "AssignedWorkout"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignedExercise_assignedWorkoutId_order_key" ON "AssignedExercise"("assignedWorkoutId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSession_assignedWorkoutId_key" ON "WorkoutSession"("assignedWorkoutId");

-- CreateIndex
CREATE INDEX "WorkoutSession_studentId_startedAt_idx" ON "WorkoutSession"("studentId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseLog_sessionId_assignedExerciseId_key" ON "ExerciseLog"("sessionId", "assignedExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "SetLog_exerciseLogId_setNumber_key" ON "SetLog"("exerciseLogId", "setNumber");

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplate" ADD CONSTRAINT "WorkoutTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplate" ADD CONSTRAINT "WorkoutTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateExercise" ADD CONSTRAINT "TemplateExercise_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateExercise" ADD CONSTRAINT "TemplateExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlan" ADD CONSTRAINT "WorkoutPlan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlan" ADD CONSTRAINT "WorkoutPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanWorkout" ADD CONSTRAINT "PlanWorkout_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WorkoutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanWorkout" ADD CONSTRAINT "PlanWorkout_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPlanAssignment" ADD CONSTRAINT "StudentPlanAssignment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPlanAssignment" ADD CONSTRAINT "StudentPlanAssignment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WorkoutPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPlanAssignment" ADD CONSTRAINT "StudentPlanAssignment_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPlanAssignment" ADD CONSTRAINT "StudentPlanAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedWorkout" ADD CONSTRAINT "AssignedWorkout_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedWorkout" ADD CONSTRAINT "AssignedWorkout_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "StudentPlanAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedWorkout" ADD CONSTRAINT "AssignedWorkout_planWorkoutId_fkey" FOREIGN KEY ("planWorkoutId") REFERENCES "PlanWorkout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedExercise" ADD CONSTRAINT "AssignedExercise_assignedWorkoutId_fkey" FOREIGN KEY ("assignedWorkoutId") REFERENCES "AssignedWorkout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_assignedWorkoutId_fkey" FOREIGN KEY ("assignedWorkoutId") REFERENCES "AssignedWorkout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_assignedExerciseId_fkey" FOREIGN KEY ("assignedExerciseId") REFERENCES "AssignedExercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_exerciseLogId_fkey" FOREIGN KEY ("exerciseLogId") REFERENCES "ExerciseLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

