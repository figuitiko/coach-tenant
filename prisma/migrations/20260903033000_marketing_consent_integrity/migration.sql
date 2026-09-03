BEGIN;

-- Make immutable result history deletion explicit instead of cascading through membership.
ALTER TABLE "StudentResultStory"
  DROP CONSTRAINT "StudentResultStory_studentMembershipId_workspaceId_fkey";

-- Replace the workspace-only current-version pointer with an exact-story pointer.
ALTER TABLE "StudentResultStory"
  DROP CONSTRAINT "StudentResultStory_currentVersionId_workspaceId_fkey";
DROP INDEX "StudentResultStory_currentVersionId_workspaceId_key";

-- Preserve exact approval evidence when a result version deletion is attempted.
ALTER TABLE "StudentResultApproval"
  DROP CONSTRAINT "StudentResultApproval_resultVersionId_workspaceId_fkey";

CREATE UNIQUE INDEX "StudentResultVersion_id_storyId_workspaceId_key"
  ON "StudentResultVersion"("id", "storyId", "workspaceId");
CREATE UNIQUE INDEX "StudentResultStory_currentVersionId_id_workspaceId_key"
  ON "StudentResultStory"("currentVersionId", "id", "workspaceId");

ALTER TABLE "StudentResultStory"
  ADD CONSTRAINT "StudentResultStory_studentMembershipId_workspaceId_fkey"
  FOREIGN KEY ("studentMembershipId", "workspaceId")
  REFERENCES "Membership"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentResultStory"
  ADD CONSTRAINT "StudentResultStory_currentVersionId_id_workspaceId_fkey"
  FOREIGN KEY ("currentVersionId", "id", "workspaceId")
  REFERENCES "StudentResultVersion"("id", "storyId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentResultApproval"
  ADD CONSTRAINT "StudentResultApproval_resultVersionId_workspaceId_fkey"
  FOREIGN KEY ("resultVersionId", "workspaceId")
  REFERENCES "StudentResultVersion"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
