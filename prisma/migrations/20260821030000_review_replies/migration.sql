CREATE TABLE "ReviewReply" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "reviewNoteId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewReply_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReviewReply_reviewNoteId_key" ON "ReviewReply"("reviewNoteId");
CREATE INDEX "ReviewReply_workspaceId_createdAt_idx" ON "ReviewReply"("workspaceId", "createdAt");
CREATE INDEX "ReviewReply_studentId_createdAt_idx" ON "ReviewReply"("studentId", "createdAt");
ALTER TABLE "ReviewReply" ADD CONSTRAINT "ReviewReply_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewReply" ADD CONSTRAINT "ReviewReply_reviewNoteId_fkey" FOREIGN KEY ("reviewNoteId") REFERENCES "ReviewNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewReply" ADD CONSTRAINT "ReviewReply_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
