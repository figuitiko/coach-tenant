CREATE TYPE "UploadIntentStatus" AS ENUM ('PENDING', 'CONSUMED', 'EXPIRED');
ALTER TABLE "MeasurementCheckIn" ADD COLUMN "draftSlot" TEXT;
WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "workspaceId", "studentId" ORDER BY "createdAt" DESC, "id" DESC) AS position
  FROM "MeasurementCheckIn" WHERE "status" = 'DRAFT'
)
UPDATE "MeasurementCheckIn" AS check_in SET "draftSlot" = 'ACTIVE' FROM ranked WHERE check_in."id" = ranked."id" AND ranked.position = 1;
CREATE UNIQUE INDEX "MeasurementCheckIn_workspaceId_studentId_draftSlot_key" ON "MeasurementCheckIn"("workspaceId", "studentId", "draftSlot");

CREATE TABLE "PhotoUploadIntent" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "checkInId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "objectKey" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "status" "UploadIntentStatus" NOT NULL DEFAULT 'PENDING', "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PhotoUploadIntent_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ProgressPhoto" ADD COLUMN "uploadIntentId" TEXT;
INSERT INTO "PhotoUploadIntent" ("id", "workspaceId", "studentId", "checkInId", "idempotencyKey", "objectKey", "mimeType", "sizeBytes", "expiresAt", "status", "consumedAt", "createdAt", "updatedAt")
SELECT 'legacy-' || "id", "workspaceId", "studentId", "checkInId", 'legacy-' || "id", "objectKey", "mimeType", "sizeBytes", "createdAt", 'CONSUMED', "createdAt", "createdAt", "createdAt" FROM "ProgressPhoto";
UPDATE "ProgressPhoto" SET "uploadIntentId" = 'legacy-' || "id";
ALTER TABLE "ProgressPhoto" ALTER COLUMN "uploadIntentId" SET NOT NULL;
CREATE UNIQUE INDEX "PhotoUploadIntent_objectKey_key" ON "PhotoUploadIntent"("objectKey");
CREATE UNIQUE INDEX "PhotoUploadIntent_workspaceId_idempotencyKey_key" ON "PhotoUploadIntent"("workspaceId", "idempotencyKey");
CREATE INDEX "PhotoUploadIntent_workspaceId_studentId_status_idx" ON "PhotoUploadIntent"("workspaceId", "studentId", "status");
CREATE UNIQUE INDEX "ProgressPhoto_uploadIntentId_key" ON "ProgressPhoto"("uploadIntentId");
ALTER TABLE "PhotoUploadIntent" ADD CONSTRAINT "PhotoUploadIntent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotoUploadIntent" ADD CONSTRAINT "PhotoUploadIntent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PhotoUploadIntent" ADD CONSTRAINT "PhotoUploadIntent_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "MeasurementCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressPhoto" ADD CONSTRAINT "ProgressPhoto_uploadIntentId_fkey" FOREIGN KEY ("uploadIntentId") REFERENCES "PhotoUploadIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
