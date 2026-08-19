CREATE TYPE "LengthUnit" AS ENUM ('CM', 'IN');
CREATE TYPE "PercentUnit" AS ENUM ('PERCENT');
CREATE TYPE "CheckInStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED');
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'REVIEWED');

ALTER TABLE "AuditEvent" ADD COLUMN "dedupeKey" TEXT;
ALTER TABLE "ProductEvent" ADD COLUMN "dedupeKey" TEXT;
ALTER TABLE "WorkoutSession" ADD COLUMN "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING', ADD COLUMN "reviewedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "AuditEvent_workspaceId_dedupeKey_key" ON "AuditEvent"("workspaceId", "dedupeKey");
CREATE UNIQUE INDEX "ProductEvent_workspaceId_dedupeKey_key" ON "ProductEvent"("workspaceId", "dedupeKey");

CREATE TABLE "MeasurementCheckIn" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  "status" "CheckInStatus" NOT NULL DEFAULT 'DRAFT', "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  "weight" DECIMAL(8,2), "weightUnit" "WeightUnit", "bodyFat" DECIMAL(5,2), "bodyFatUnit" "PercentUnit",
  "chest" DECIMAL(8,2), "chestUnit" "LengthUnit", "waist" DECIMAL(8,2), "waistUnit" "LengthUnit",
  "hips" DECIMAL(8,2), "hipsUnit" "LengthUnit", "arm" DECIMAL(8,2), "armUnit" "LengthUnit", "thigh" DECIMAL(8,2), "thighUnit" "LengthUnit",
  "notes" TEXT, "submitIdempotencyKey" TEXT, "submittedAt" TIMESTAMP(3), "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeasurementCheckIn_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProgressPhoto" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "checkInId" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL, "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProgressPhoto_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ReviewNote" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "coachId" TEXT NOT NULL, "checkInId" TEXT, "workoutSessionId" TEXT,
  "body" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewNote_exactly_one_target" CHECK (("checkInId" IS NOT NULL)::int + ("workoutSessionId" IS NOT NULL)::int = 1)
);
CREATE INDEX "MeasurementCheckIn_workspaceId_studentId_createdAt_idx" ON "MeasurementCheckIn"("workspaceId", "studentId", "createdAt");
CREATE INDEX "MeasurementCheckIn_workspaceId_reviewStatus_submittedAt_idx" ON "MeasurementCheckIn"("workspaceId", "reviewStatus", "submittedAt");
CREATE UNIQUE INDEX "MeasurementCheckIn_workspaceId_submitIdempotencyKey_key" ON "MeasurementCheckIn"("workspaceId", "submitIdempotencyKey");
CREATE UNIQUE INDEX "ProgressPhoto_objectKey_key" ON "ProgressPhoto"("objectKey");
CREATE INDEX "ProgressPhoto_workspaceId_studentId_createdAt_idx" ON "ProgressPhoto"("workspaceId", "studentId", "createdAt");
CREATE UNIQUE INDEX "ProgressPhoto_workspaceId_idempotencyKey_key" ON "ProgressPhoto"("workspaceId", "idempotencyKey");
CREATE INDEX "ReviewNote_workspaceId_createdAt_idx" ON "ReviewNote"("workspaceId", "createdAt");
CREATE INDEX "ReviewNote_checkInId_idx" ON "ReviewNote"("checkInId");
CREATE INDEX "ReviewNote_workoutSessionId_idx" ON "ReviewNote"("workoutSessionId");
CREATE UNIQUE INDEX "ReviewNote_workspaceId_idempotencyKey_key" ON "ReviewNote"("workspaceId", "idempotencyKey");
ALTER TABLE "MeasurementCheckIn" ADD CONSTRAINT "MeasurementCheckIn_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeasurementCheckIn" ADD CONSTRAINT "MeasurementCheckIn_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgressPhoto" ADD CONSTRAINT "ProgressPhoto_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressPhoto" ADD CONSTRAINT "ProgressPhoto_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgressPhoto" ADD CONSTRAINT "ProgressPhoto_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "MeasurementCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewNote" ADD CONSTRAINT "ReviewNote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewNote" ADD CONSTRAINT "ReviewNote_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewNote" ADD CONSTRAINT "ReviewNote_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "MeasurementCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewNote" ADD CONSTRAINT "ReviewNote_workoutSessionId_fkey" FOREIGN KEY ("workoutSessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
