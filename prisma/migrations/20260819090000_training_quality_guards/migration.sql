ALTER TABLE "Workspace"
ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'America/Mexico_City';

CREATE UNIQUE INDEX "StudentPlanAssignment_workspaceId_planId_studentMembershipId_key"
ON "StudentPlanAssignment"("workspaceId", "planId", "studentMembershipId");
